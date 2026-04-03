from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .authentication import JWTAuthentication
from .models import User
from django.contrib.auth.hashers import make_password, check_password
import jwt
import datetime
from django.conf import settings
from mongoengine import NotUniqueError
from mongoengine.errors import DoesNotExist
from departments.models import Department
from .permissions import IsAdmin


def serialize_user(u, include_department=True):
    """Consistent user serialization across all endpoints."""
    dep_name = None
    dep_id = None
    try:
        if u.department:
            dep_name = u.department.name
            dep_id = str(u.department.id)
    except Exception:
        pass

    data = {
        'id': str(u.id),
        'username': u.username,
        'email': u.email,
        'role': u.role,
    }
    if include_department:
        data['department_id'] = dep_id
        data['department_name'] = dep_name
    return data


@api_view(['POST'])
@authentication_classes([])
@permission_classes([])
def register(request):
    data = request.data
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not username or not email or not password:
        return Response({'error': 'Please provide username, email, and password'}, status=400)

    try:
        user = User(username=username, email=email, password=make_password(password))
        user.save()
        return Response({'message': 'User registered successfully', 'user': serialize_user(user)}, status=201)
    except NotUniqueError:
        return Response({'error': 'Username or email already exists'}, status=400)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([])
def login(request):
    data = request.data
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return Response({'error': 'Please provide username and password'}, status=400)

    user = User.objects(username=username).first()
    if not user or not check_password(password, user.password):
        return Response({'error': 'Invalid credentials'}, status=401)

    payload = {
        'user_id': str(user.id),
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1),
        'iat': datetime.datetime.utcnow()
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')
    if isinstance(token, bytes):
        token = token.decode('utf-8')

    return Response({
        'token': token,
        'role': user.role,
        'user': serialize_user(user),
    })


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def protected_view(request):
    return Response({'message': 'Authenticated.', 'user': serialize_user(request.user)})


@api_view(['GET', 'PATCH'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def me_view(request):
    """GET current user info. PATCH to update own profile (username, email, password)."""
    if request.method == 'GET':
        return Response(serialize_user(request.user))

    if request.method == 'PATCH':
        user = request.user
        data = request.data

        new_username = data.get('username', '').strip()
        new_email = data.get('email', '').strip()
        new_password = data.get('password', '').strip()
        current_password = data.get('current_password', '').strip()

        # Require current password to make any change
        if not current_password:
            return Response({'error': 'current_password is required to update your profile.'}, status=400)

        if not check_password(current_password, user.password):
            return Response({'error': 'Current password is incorrect.'}, status=400)

        if new_username and new_username != user.username:
            if User.objects(username=new_username).first():
                return Response({'error': 'Username already taken.'}, status=400)
            user.username = new_username

        if new_email and new_email != user.email:
            if User.objects(email=new_email).first():
                return Response({'error': 'Email already in use.'}, status=400)
            user.email = new_email

        if new_password:
            if len(new_password) < 6:
                return Response({'error': 'New password must be at least 6 characters.'}, status=400)
            user.password = make_password(new_password)

        try:
            user.save()
        except NotUniqueError:
            return Response({'error': 'Username or email already exists.'}, status=400)

        return Response({'message': 'Profile updated successfully.', 'user': serialize_user(user)})


@api_view(['GET', 'POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAdmin])
def employee_list_create(request):
    if request.method == 'GET':
        employees = User.objects(role='EMPLOYEE')
        return Response([serialize_user(e) for e in employees])

    if request.method == 'POST':
        data = request.data
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        department_id = data.get('department_id')

        if not username or not email or not password or not department_id:
            return Response({'error': 'username, email, password, and department_id are required'}, status=400)

        try:
            dep = Department.objects.get(id=department_id)
        except Exception:
            return Response({'error': 'Department not found'}, status=404)

        try:
            user = User(
                username=username,
                email=email,
                password=make_password(password),
                role='EMPLOYEE',
                department=dep
            )
            user.save()
            return Response({'message': 'Employee created successfully', 'user': serialize_user(user)}, status=201)
        except NotUniqueError:
            return Response({'error': 'Username or email already exists'}, status=400)


@api_view(['GET', 'PATCH', 'DELETE'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def employee_detail(request, pk):
    """
    GET   — any authenticated user can view a profile.
    PATCH — admin can update any employee; employees can update only themselves.
    DELETE — admin only.
    """
    try:
        employee = User.objects.get(id=pk)
    except DoesNotExist:
        return Response({'error': 'User not found'}, status=404)

    if request.method == 'GET':
        return Response(serialize_user(employee))

    if request.method == 'PATCH':
        # Employees can only update their own profile
        if request.user.role == 'EMPLOYEE' and str(request.user.id) != str(employee.id):
            return Response({'error': 'You can only update your own profile.'}, status=403)

        data = request.data

        # Employees must confirm current password; admins bypass this
        if request.user.role == 'EMPLOYEE':
            current_password = data.get('current_password', '').strip()
            if not current_password:
                return Response({'error': 'current_password is required.'}, status=400)
            if not check_password(current_password, employee.password):
                return Response({'error': 'Current password is incorrect.'}, status=400)

        new_username = data.get('username', '').strip()
        new_email = data.get('email', '').strip()
        new_password = data.get('password', '').strip()
        new_department_id = data.get('department_id', '').strip()

        if new_username and new_username != employee.username:
            if User.objects(username=new_username).first():
                return Response({'error': 'Username already taken.'}, status=400)
            employee.username = new_username

        if new_email and new_email != employee.email:
            if User.objects(email=new_email).first():
                return Response({'error': 'Email already in use.'}, status=400)
            employee.email = new_email

        if new_password:
            if len(new_password) < 6:
                return Response({'error': 'Password must be at least 6 characters.'}, status=400)
            employee.password = make_password(new_password)

        # Only admin can change department
        if new_department_id and request.user.role == 'ADMIN':
            try:
                dep = Department.objects.get(id=new_department_id)
                employee.department = dep
            except Exception:
                return Response({'error': 'Department not found.'}, status=404)

        try:
            employee.save()
        except NotUniqueError:
            return Response({'error': 'Username or email already exists.'}, status=400)

        return Response({'message': 'Profile updated successfully.', 'user': serialize_user(employee)})

    if request.method == 'DELETE':
        if request.user.role != 'ADMIN':
            return Response({'error': 'Only admins can delete accounts.'}, status=403)
        employee.delete()
        return Response({'message': 'User deleted.'}, status=204)

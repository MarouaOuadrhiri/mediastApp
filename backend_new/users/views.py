from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .authentication import JWTAuthentication
from .models import User, AttendanceRecord
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
    is_online = False
    current_session_start = None
    total_seconds_today = 0
    today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    records = AttendanceRecord.objects(user=u, start_time__gte=today_start)
    for r in records:
        if r.status == 'COMPLETED' and r.end_time:
            delta = r.end_time - r.start_time
            total_seconds_today += delta.total_seconds()

    def format_seconds(s):
        h = int(s // 3600)
        m = int((s % 3600) // 60)
        s = int(s % 60)
        return f"{h:02d}:{m:02d}:{s:02d}"

    try:
        active_session = AttendanceRecord.objects(user=u, status='ACTIVE').first()
        if active_session:
            is_online = True
            current_session_start = active_session.start_time.isoformat() + 'Z'
    except:
        pass

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
        'email': u.email,
        'first_name': getattr(u, 'first_name', ''),
        'last_name': getattr(u, 'last_name', ''),
        'role': u.role,
        'profile_photo': getattr(u, 'profile_photo', ''),
        'is_online': is_online,
        'current_session_start': current_session_start,
        'total_work_today': format_seconds(total_seconds_today)
    }
    
    last_task = None
    try:
        from tasks.models import Task
        t = Task.objects(employees=u.id).order_by('-id').first()
        if t:
            last_task = {'title': t.title, 'status': t.status}
    except Exception:
        pass

    if not last_task:
        try:
            from projects.models import Project
            from mongoengine.queryset.visitor import Q
            filters = [Q(employees=u.id), Q(tasks__completed_by=u.id)]
            if u.department:
                filters.append(Q(department=u.department.id))
            query = filters[0]
            for q in filters[1:]:
                query |= q
            
            p = Project.objects.filter(query).order_by('-start_date').first()
            if p and p.tasks:
                target_task = None
                for task in reversed(p.tasks):
                    if getattr(task, 'status', '') != 'DONE':
                        target_task = task
                        break
                if not target_task:
                    target_task = p.tasks[-1]
                last_task = {'title': target_task.title, 'status': target_task.status}
        except Exception:
            pass

    data['last_task'] = last_task
    if include_department:
        data['department_id'] = dep_id
        data['department_name'] = dep_name
    return data


@api_view(['POST'])
@authentication_classes([])
@permission_classes([])
def register(request):
    data = request.data
    email = data.get('email')
    password = data.get('password')
    first_name = data.get('first_name', '')
    last_name = data.get('last_name', '')

    if not email or not password:
        return Response({'error': 'Please provide email and password'}, status=400)

    try:
        user = User(
            email=email, 
            password=make_password(password),
            first_name=first_name,
            last_name=last_name,
            profile_photo=data.get('profile_photo', '')
        )
        user.save()
        return Response({'message': 'User registered successfully', 'user': serialize_user(user)}, status=201)
    except NotUniqueError:
        return Response({'error': 'Email address already exists'}, status=400)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([])
def login(request):
    data = request.data
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return Response({'error': 'Please provide email and password'}, status=400)

    user = User.objects(email=email).first()
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

    # Start attendance session for all users
    # Close any lingering active sessions
    AttendanceRecord.objects(user=user, status='ACTIVE').update(
        set__end_time=datetime.datetime.utcnow(),
        set__status='COMPLETED'
    )
    # Create new active session
    AttendanceRecord(
        user=user,
        start_time=datetime.datetime.utcnow(),
        status='ACTIVE'
    ).save()

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
    """GET current user info. PATCH to update own profile (first_name, last_name, email, password)."""
    if request.method == 'GET':
        return Response(serialize_user(request.user))

    if request.method == 'PATCH':
        user = request.user
        data = request.data

        new_email = data.get('email', '').strip()
        new_password = data.get('password', '').strip()
        current_password = data.get('current_password', '').strip()
        new_first_name = data.get('first_name', '').strip()
        new_last_name = data.get('last_name', '').strip()

        # Require current password to make any change
        if not current_password:
            return Response({'error': 'current_password is required to update your profile.'}, status=400)

        if not check_password(current_password, user.password):
            return Response({'error': 'Current password is incorrect.'}, status=400)

        if new_first_name: user.first_name = new_first_name
        if new_last_name: user.last_name = new_last_name

        if new_email and new_email != user.email:
            if User.objects(email=new_email).first():
                return Response({'error': 'Email already in use.'}, status=400)
            user.email = new_email

        if new_password:
            if len(new_password) < 6:
                return Response({'error': 'New password must be at least 6 characters.'}, status=400)
            user.password = make_password(new_password)

        if 'profile_photo' in data:
            user.profile_photo = data.get('profile_photo', '')

        try:
            user.save()
        except NotUniqueError:
            return Response({'error': 'Email address already exists.'}, status=400)

        return Response({'message': 'Profile updated successfully.', 'user': serialize_user(user)})


@api_view(['GET', 'POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAdmin])
def employee_list_create(request):
    if request.method == 'GET':
        employees = User.objects(role='EMPLOYEE')
        
        from projects.models import Project
        from tasks.models import Task
        from mongoengine.queryset.visitor import Q
        
        response_data = []
        for e in employees:
            data = serialize_user(e)
            uid = e.id
            
            filters = [Q(employees=uid), Q(tasks__completed_by=uid)]
            if e.department:
                filters.append(Q(department=e.department.id))
            
            query = filters[0]
            for q in filters[1:]:
                query |= q

            projects = Project.objects.filter(query)
            
            total_tasks = 0
            done_tasks = 0
            
            for p in projects:
                for t in p.tasks:
                    total_tasks += 1
                    if t.status == 'DONE':
                        done_tasks += 1
                        
            standalone = Task.objects(employees=uid)
            for t in standalone:
                total_tasks += 1
                if t.status == 'DONE':
                    done_tasks += 1
            
            if total_tasks > 0:
                progress = int((done_tasks / total_tasks) * 100)
            else:
                progress = 0
                
            active_tasks = total_tasks - done_tasks
            
            if active_tasks == 0:
                status = "Available"
            elif active_tasks <= 5:
                status = "Busy"
            else:
                status = "At Capacity"
                
            data['workload_progress'] = progress
            data['workload_status'] = status
            data['active_tasks'] = active_tasks
            response_data.append(data)
            
        return Response(response_data)

    if request.method == 'POST':
        data = request.data
        email = data.get('email')
        password = data.get('password')
        first_name = data.get('first_name', '')
        last_name = data.get('last_name', '')
        department_id = data.get('department_id')

        if not email or not password or not department_id:
            return Response({'error': 'email, password, and department_id are required'}, status=400)

        try:
            dep = Department.objects.get(id=department_id)
        except Exception:
            return Response({'error': 'Department not found'}, status=404)

        try:
            user = User(
                email=email,
                password=make_password(password),
                first_name=first_name,
                last_name=last_name,
                role='EMPLOYEE',
                department=dep,
                profile_photo=data.get('profile_photo', '')
            )
            user.save()
            return Response({'message': 'Employee created successfully', 'user': serialize_user(user)}, status=201)
        except NotUniqueError:
            return Response({'error': 'Email address already exists'}, status=400)


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

        new_email = data.get('email', '').strip()
        new_password = data.get('password', '').strip()
        new_department_id = data.get('department_id', '').strip()
        new_first_name = data.get('first_name', '').strip()
        new_last_name = data.get('last_name', '').strip()

        if new_first_name: employee.first_name = new_first_name
        if new_last_name: employee.last_name = new_last_name

        if new_email and new_email != employee.email:
            if User.objects(email=new_email).first():
                return Response({'error': 'Email already in use.'}, status=400)
            employee.email = new_email

        if new_password:
            if len(new_password) < 6:
                return Response({'error': 'Password must be at least 6 characters.'}, status=400)
            employee.password = make_password(new_password)

        if 'profile_photo' in data:
            employee.profile_photo = data.get('profile_photo', '')

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
            return Response({'error': 'Email address already exists.'}, status=400)

        return Response({'message': 'Profile updated successfully.', 'user': serialize_user(employee)})

    if request.method == 'DELETE':
        if request.user.role != 'ADMIN':
            return Response({'error': 'Only admins can delete accounts.'}, status=403)
        employee.delete()
        return Response({'message': 'User deleted.'}, status=204)


from bson import ObjectId

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAdmin])
def get_employee_history(request, pk):
    """
    Returns history for an employee:
    - Projects assigned to them (ordered by newest start_date).
    - Progress of those projects.
    - Status of tasks within those projects.
    - Standalone tasks assigned to them.
    """
    try:
        uid = ObjectId(pk)
        user = User.objects.get(id=uid)
    except:
        return Response({'error': 'User not found'}, status=404)

    from projects.models import Project
    from tasks.models import Task
    from mongoengine.queryset.visitor import Q

    # Search for anything where the user is explicitly listed or part of the assigned department
    # Query for the department or direct assignment
    filters = [Q(employees=uid), Q(tasks__completed_by=uid)]
    if user.department:
        filters.append(Q(department=user.department.id))
    
    query = filters[0]
    for q in filters[1:]:
        query |= q

    # Optimized fetch using standard filter() call
    projects = Project.objects.filter(query).order_by('-start_date')

    project_data = []
    for p in projects:
        total_tasks = len(p.tasks)
        done_tasks = len([t for t in p.tasks if t.status == 'DONE'])
        progress = (done_tasks / total_tasks * 100) if total_tasks > 0 else 0
        
        project_data.append({
            'id': str(p.id),
            'name': p.name,
            'description': p.description,
            'progress': round(progress, 1),
            'status': 'DONE' if progress == 100 and total_tasks > 0 else 'IN_PROGRESS' if progress > 0 else 'TODO',
            'start_date': p.start_date.isoformat() if p.start_date else None,
            'deadline': p.deadline.isoformat() if p.deadline else None,
            'tasks': [
                {
                    'id': str(t.id),
                    'title': t.title,
                    'status': t.status,
                    'progress': 100 if t.status == 'DONE' else 50 if t.status == 'IN_PROGRESS' else 0,
                    # Optimization: if completed by the same user, we already have their name in memory
                    'completed_by_name': f"{user.first_name} {user.last_name}" if (getattr(t, 'completed_by', None) and str(t.completed_by.id) == str(uid)) else (f"{t.completed_by.first_name} {t.completed_by.last_name}" if getattr(t, 'completed_by', None) else None)
                } for t in p.tasks
            ]
        })

    # Standalone Tasks
    tasks = Task.objects(employees=user.id).order_by('-id')
    task_data = [{
        'id': str(t.id),
        'title': t.title,
        'status': t.status
    } for t in tasks]

    return Response({
        'user': serialize_user(user),
        'projects': project_data,
        'standalone_tasks': task_data
    })


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def end_attendance(request):
    """End the current active session for the user."""
    AttendanceRecord.objects(user=request.user, status='ACTIVE').update(
        set__end_time=datetime.datetime.utcnow(),
        set__status='COMPLETED'
    )
    return Response({'message': 'Attendance session ended.'})

@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def start_attendance(request):
    """Start a new active session for the user."""
    # Ensure no lingering active sessions
    AttendanceRecord.objects(user=request.user, status='ACTIVE').update(
        set__end_time=datetime.datetime.utcnow(),
        set__status='COMPLETED'
    )
    AttendanceRecord(
        user=request.user,
        start_time=datetime.datetime.utcnow(),
        status='ACTIVE'
    ).save()
    return Response({'message': 'Attendance session started.'})


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def get_current_attendance(request):
    """Check if there is an active session and return it."""
    session = AttendanceRecord.objects(user=request.user, status='ACTIVE').first()
    if session:
        return Response({
            'start_time': session.start_time.isoformat() + 'Z',
            'status': session.status
        })
    return Response(None)


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAdmin])
def get_employee_attendance_logs(request, pk):
    """Admin view for employee attendance history."""
    try:
        user = User.objects.get(id=pk)
    except Exception:
        return Response({'error': 'User not found'}, status=404)
        
    logs = AttendanceRecord.objects(user=user).order_by('-start_time')
    return Response([{
        'id': str(l.id),
        'start_time': l.start_time.isoformat() + 'Z',
        'end_time': (l.end_time.isoformat() + 'Z') if l.end_time else None,
        'status': l.status,
        'duration': str(l.end_time - l.start_time).split('.')[0] if l.end_time else 'Active'
    } for l in logs])

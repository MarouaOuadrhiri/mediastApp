from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from users.authentication import JWTAuthentication
from users.permissions import IsAdmin
from .models import Department
from mongoengine.errors import DoesNotExist, NotUniqueError

@api_view(['GET', 'POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def department_list_create(request):
    if request.method == 'GET':
        deps = Department.objects.all()
        return Response([{'id': str(d.id), 'name': d.name, 'description': d.description} for d in deps])
    
    if request.method == 'POST':
        # Only admin can create
        if request.user.role != 'ADMIN':
            return Response({'error': 'Unauthorized'}, status=403)
        
        name = request.data.get('name')
        description = request.data.get('description', '')
        if not name:
            return Response({'error': 'Name is required'}, status=400)
        
        try:
            dep = Department(name=name, description=description)
            dep.save()
            return Response({'id': str(dep.id), 'name': dep.name, 'description': dep.description}, status=201)
        except NotUniqueError:
            return Response({'error': 'Department already exists'}, status=400)

@api_view(['GET', 'PUT', 'DELETE'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def department_detail(request, pk):
    try:
        dep = Department.objects.get(id=pk)
    except DoesNotExist:
        return Response({'error': 'Not found'}, status=404)

    if request.method == 'GET':
        return Response({'id': str(dep.id), 'name': dep.name, 'description': dep.description})

    # PUT and DELETE require ADMIN
    if request.user.role != 'ADMIN':
        return Response({'error': 'Unauthorized'}, status=403)

    if request.method == 'PUT':
        dep.name = request.data.get('name', dep.name)
        dep.description = request.data.get('description', dep.description)
        try:
            dep.save()
            return Response({'id': str(dep.id), 'name': dep.name, 'description': dep.description})
        except NotUniqueError:
            return Response({'error': 'Department name already exists'}, status=400)
        
    if request.method == 'DELETE':
        dep.delete()
        return Response({'message': 'Deleted'}, status=204)

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
    from users.models import User
    from projects.models import Project
    from tasks.models import Task

    if request.method == 'GET':
        deps = Department.objects.all()
        data = []
        for d in deps:
            # Metrics calculation
            employees = User.objects(department=d)
            emp_ids = [e.id for e in employees]
            
            # Tasks from projects
            projects = Project.objects(department=d)
            project_tasks = []
            for p in projects:
                project_tasks.extend(p.tasks)
            
            # Standalone tasks for employees in this department
            standalone_tasks = Task.objects(employees__in=emp_ids)
            
            all_tasks = project_tasks + list(standalone_tasks)
            total_tasks = len(all_tasks)
            done_tasks = len([t for t in all_tasks if t.status == 'DONE'])
            active_tasks = total_tasks - done_tasks
            
            efficiency = (done_tasks / total_tasks * 100) if total_tasks > 0 else 0
            
            # Determine status
            status = 'STABLE'
            if efficiency >= 90: status = 'OPTIMAL'
            elif efficiency >= 75: status = 'STABLE'
            elif efficiency >= 70: status = 'AT CAPACITY'
            else: status = 'CRITICAL'
            
            data.append({
                'id': str(d.id),
                'name': d.name,
                'subtitle': d.subtitle or '',
                'description': d.description or '',
                'icon': d.icon or '',
                'image': d.image or '',
                'employees_count': len(employees),
                'active_tasks_count': active_tasks,
                'efficiency': round(efficiency),
                'status': status
            })
        return Response(data)
    
    if request.method == 'POST':
        if request.user.role != 'ADMIN':
            return Response({'error': 'Unauthorized'}, status=403)
        
        name = request.data.get('name')
        subtitle = request.data.get('subtitle', '')
        description = request.data.get('description', '')
        icon = request.data.get('icon', '')
        image = request.data.get('image', '')
        
        if not name:
            return Response({'error': 'Name is required'}, status=400)
        
        try:
            dep = Department(name=name, subtitle=subtitle, description=description, icon=icon, image=image)
            dep.save()
            return Response({'id': str(dep.id), 'name': dep.name}, status=201)
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
        from users.models import User
        from projects.models import Project
        
        employees = User.objects(department=dep)
        projects = Project.objects(department=dep)
        
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
                'tasks_count': total_tasks,
                'done_tasks_count': done_tasks,
                'status': 'DONE' if progress == 100 and total_tasks > 0 else 'IN_PROGRESS' if progress > 0 else 'TODO',
                'tasks': [
                    {
                        'title': t.title,
                        'status': t.status,
                        'completed_by_name': f"{t.completed_by.first_name} {t.completed_by.last_name}" if getattr(t, 'completed_by', None) else None
                    } for t in p.tasks
                ]
            })

        return Response({
            'id': str(dep.id),
            'name': dep.name,
            'description': dep.description,
            'image': dep.image or '',
            'employees': [
                {
                    'id': str(e.id), 
                    'first_name': getattr(e, 'first_name', ''), 
                    'last_name': getattr(e, 'last_name', ''), 
                    'email': e.email, 
                    'role': e.role, 
                    'profile_photo': e.profile_photo or ''
                } for e in employees
            ],
            'projects': project_data
        })

    # PUT and DELETE require ADMIN
    if request.user.role != 'ADMIN':
        return Response({'error': 'Unauthorized'}, status=403)

    if request.method == 'PUT':
        dep.name = request.data.get('name', dep.name)
        dep.subtitle = request.data.get('subtitle', dep.subtitle)
        dep.description = request.data.get('description', dep.description)
        dep.icon = request.data.get('icon', dep.icon)
        dep.image = request.data.get('image', dep.image)
        try:
            dep.save()
            return Response({'id': str(dep.id), 'name': dep.name})
        except NotUniqueError:
            return Response({'error': 'Department name already exists'}, status=400)
        
    if request.method == 'DELETE':
        dep.delete()
        return Response({'message': 'Deleted'}, status=204)

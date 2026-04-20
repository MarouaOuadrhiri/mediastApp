from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from users.authentication import JWTAuthentication
from users.permissions import IsAdmin
from users.models import User
from departments.models import Department
from .models import Project, ProjectTask
from mongoengine.errors import DoesNotExist
from mongoengine.queryset.visitor import Q
import bson
from datetime import datetime, timedelta

def serialize_project(p):
    return {
        'id': str(p.id),
        'name': p.name,
        'client': getattr(p, 'client', ''),
        'description': p.description,
        'owner': str(p.owner) if getattr(p, 'owner', None) else None,
        'status': getattr(p, 'status', 'Pending'),
        'priority': getattr(p, 'priority', 'MEDIUM'),
        'is_high_priority': getattr(p, 'is_high_priority', False),
        'budget': getattr(p, 'budget', ''),
        'duration': getattr(p, 'duration', ''),
        'tags': getattr(p, 'tags', []),
        'department_id': str(p.department.id) if p.department else None,
        'department_name': getattr(p.department, 'name', None) if p.department and not isinstance(p.department, bson.DBRef) else (Department.objects.filter(id=p.department.id).first().name if p.department and Department.objects.filter(id=p.department.id).first() else None),
        'employees': [
            {
                'id': str(e.id), 
                'name': f"{e.first_name} {e.last_name}" if not isinstance(e, bson.DBRef) else f"{User.objects.filter(id=e.id).first().first_name} {User.objects.filter(id=e.id).first().last_name}",
                'profile_photo': getattr(e, 'profile_photo', '') if not isinstance(e, bson.DBRef) else getattr(User.objects.filter(id=e.id).first(), 'profile_photo', '')
            } for e in p.employees
        ],
        'start_date': p.start_date.isoformat() if p.start_date else None,
        'deadline': p.deadline.isoformat() if p.deadline else None,
        'tasks': [
            {
                'id': str(t.id),
                'title': t.title,
                'description': t.description,
                'note': getattr(t, 'note', ''),
                'status': t.status,
                'deadline': t.deadline.isoformat() if getattr(t, 'deadline', None) else None,
                'completed_by_name': (
                    f"{t.completed_by.first_name} {t.completed_by.last_name}" if not isinstance(t.completed_by, bson.DBRef) and hasattr(t.completed_by, 'first_name')
                    else f"{User.objects.filter(id=t.completed_by.id).first().first_name} {User.objects.filter(id=t.completed_by.id).first().last_name}" if t.completed_by else None
                ) if getattr(t, 'completed_by', None) else None,
                'completed_at': t.completed_at.isoformat() if getattr(t, 'completed_at', None) else None,
            } for t in p.tasks
        ]
    }

@api_view(['GET', 'POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def project_list_create(request):
    if request.method == 'GET':
        if request.user.role == 'ADMIN':
            projects = Project.objects.all()
        else:
            user = request.user
            projects = Project.objects(
                Q(employees=user) | 
                (Q(employees__size=0) & Q(department=user.department))
            )
        return Response([serialize_project(p) for p in projects])

    if request.method == 'POST':
        if request.user.role != 'ADMIN':
            return Response({'error': 'Unauthorized'}, status=403)

        name = request.data.get('name')
        client = request.data.get('client', '')
        description = request.data.get('description', '')
        department_id = request.data.get('department_id')
        employee_ids = request.data.get('employee_ids', [])
        tasks_data = request.data.get('tasks', [])
        deadline_str = request.data.get('deadline')
        
        owner = request.data.get('owner')
        status = request.data.get('status', 'Pending')
        priority = request.data.get('priority', 'MEDIUM')
        is_high_priority = request.data.get('is_high_priority', False)
        budget = request.data.get('budget', '')
        duration_str = request.data.get('duration', '')
        tags = request.data.get('tags', [])

        if not name:
            return Response({'error': 'name is required'}, status=400)
            
        if not department_id and not employee_ids:
            return Response({'error': 'You must assign either a department or at least one employee'}, status=400)

        department = None
        if department_id:
            try:
                department = Department.objects.get(id=department_id)
            except DoesNotExist:
                return Response({'error': 'Department not found'}, status=404)

        # Owner is now a string from request.data
        pass

        employees = []
        if employee_ids:
            employees = list(User.objects(id__in=employee_ids, role='EMPLOYEE'))

        start_date = datetime.utcnow()
        deadline = None
        if deadline_str:
            try:
                deadline = datetime.fromisoformat(deadline_str.replace('Z', '+00:00')).replace(tzinfo=None)
            except ValueError:
                pass

        tasks = []
        valid_tasks_data = [t for t in tasks_data if t.get('title')]
        num_tasks = len(valid_tasks_data)
        
        for i, t in enumerate(valid_tasks_data):
            task_deadline = None
            if deadline and start_date and num_tasks > 0:
                duration_td = deadline - start_date
                task_duration = duration_td / num_tasks
                task_deadline = start_date + task_duration * (i + 1)
                
            tasks.append(ProjectTask(
                title=t.get('title', ''), 
                description=t.get('description', ''),
                note=t.get('note', ''),
                deadline=task_deadline
            ))

        project = Project(
            name=name, 
            client=client,
            description=description, 
            owner=owner,
            status=status,
            priority=priority,
            is_high_priority=is_high_priority,
            budget=budget,
            duration=duration_str,
            tags=tags,
            department=department,
            employees=employees,
            start_date=start_date,
            deadline=deadline,
            tasks=tasks
        )
        project.save()
        return Response(serialize_project(project), status=201)

@api_view(['PUT', 'DELETE'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def project_detail(request, pk):
    if request.user.role != 'ADMIN':
        return Response({'error': 'Unauthorized'}, status=403)
        
    try:
        project = Project.objects.get(id=pk)
    except DoesNotExist:
        return Response({'error': 'Project not found'}, status=404)

    if request.method == 'DELETE':
        project.delete()
        return Response(status=204)

    if request.method == 'PUT':
        name = request.data.get('name')
        client = request.data.get('client', project.client if hasattr(project, 'client') else '')
        description = request.data.get('description', project.description)
        department_id = request.data.get('department_id')
        employee_ids = request.data.get('employee_ids', [])
        tasks_data = request.data.get('tasks', [])
        deadline_str = request.data.get('deadline')

        if name: project.name = name
        project.client = client
        project.description = description
        
        owner_val = request.data.get('owner')
        if owner_val is not None:
            project.owner = owner_val
        
        if 'status' in request.data: project.status = request.data['status']
        if 'priority' in request.data: project.priority = request.data['priority']
        if 'is_high_priority' in request.data: project.is_high_priority = request.data['is_high_priority']
        if 'budget' in request.data: project.budget = request.data['budget']
        if 'duration' in request.data: project.duration = request.data['duration']
        if 'tags' in request.data: project.tags = request.data['tags']

        if department_id:
            try:
                project.department = Department.objects.get(id=department_id)
            except DoesNotExist:
                pass
        else:
            project.department = None

        if employee_ids:
            project.employees = list(User.objects(id__in=employee_ids, role='EMPLOYEE'))
        else:
            project.employees = []

        if deadline_str:
            try:
                project.deadline = datetime.fromisoformat(deadline_str.replace('Z', '+00:00')).replace(tzinfo=None)
            except ValueError:
                pass

        # Update Tasks
        new_tasks = []
        valid_tasks_data = [t for t in tasks_data if t.get('title')]
        num_tasks = len(valid_tasks_data)
        
        for i, t in enumerate(valid_tasks_data):
            task_deadline = None
            if project.deadline and getattr(project, 'start_date', None) and num_tasks > 0:
                duration_td = project.deadline - project.start_date
                task_duration = duration_td / num_tasks
                task_deadline = project.start_date + task_duration * (i + 1)
            
            existing = None
            if t.get('id'):
                for et in project.tasks:
                    if str(et.id) == str(t['id']):
                        existing = et
                        break
            
            if existing:
                existing.title = t.get('title')
                existing.description = t.get('description', '')
                existing.note = t.get('note', '')
                existing.deadline = task_deadline
                new_tasks.append(existing)
            else:
                new_tasks.append(ProjectTask(
                    title=t.get('title', ''),
                    description=t.get('description', ''),
                    note=t.get('note', ''),
                    deadline=task_deadline
                ))

        project.tasks = new_tasks
        project.save()
        return Response(serialize_project(project))

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def my_projects(request):
    user = request.user
    projects = Project.objects(
        Q(employees=user) | 
        (Q(employees__size=0) & Q(department=user.department))
    )
    return Response([serialize_project(p) for p in projects])

@api_view(['PATCH'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def update_project_task_status(request, pk, task_id):
    try:
        project = Project.objects.get(id=pk)
    except DoesNotExist:
        return Response({'error': 'Project not found'}, status=404)

    is_assigned = False
    if request.user.role == 'ADMIN':
        is_assigned = True
    elif request.user in project.employees:
        is_assigned = True
    elif project.department and request.user.department == project.department:
        is_assigned = True

    if not is_assigned:
        return Response({'error': 'Unauthorized'}, status=403)

    status = request.data.get('status')
    if status not in ('TODO', 'IN_PROGRESS', 'DONE'):
        return Response({'error': 'Invalid status'}, status=400)

    for task in project.tasks:
        if str(task.id) == task_id:
            task.status = status
            if status == 'DONE':
                task.completed_by = request.user
                task.completed_at = datetime.utcnow()
            else:
                task.completed_by = None
                task.completed_at = None
            break
    else:
        return Response({'error': 'Task not found'}, status=404)

    project.save()
    return Response(serialize_project(project))

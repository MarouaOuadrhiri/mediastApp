from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from users.authentication import JWTAuthentication
from users.permissions import IsAdmin
from users.models import User
from .models import Task
from projects.models import Project, ProjectTask
from departments.models import Department
from mongoengine.errors import DoesNotExist


def serialize_task(t):
    employee_data = []
    for emp in getattr(t, 'employees', []):
        try:
            employee_data.append({
                'id': str(emp.id),
                'name': f"{emp.first_name} {emp.last_name}",
                'photo': getattr(emp, 'profile_photo', '')
            })
        except DoesNotExist:
            continue

    return {
        'id': str(t.id),
        'title': t.title,
        'description': t.description or '',
        'status': t.status,
        'employees': employee_data,
        'project_id': str(t.project.id) if getattr(t, 'project', None) else None,
        'department_id': str(t.department.id) if getattr(t, 'department', None) else None,
        'source_project_task_id': getattr(t, 'source_project_task_id', None),
        'is_archived': getattr(t, 'is_archived', False),
    }


@api_view(['GET', 'POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def task_list_create(request):
    if request.method == 'GET':
        # Admin can see archived tasks in the ARCHIVED column; Employees only see active tasks.
        if request.user.role == 'ADMIN':
            tasks = Task.objects()
        else:
            tasks = Task.objects(employees=request.user, is_archived=False)
        return Response([serialize_task(t) for t in tasks])

    if request.method == 'POST':
        title = request.data.get('title')
        description = request.data.get('description', '')
        employee_ids = request.data.get('employee_ids', [])
        project_id = request.data.get('project_id')
        department_id = request.data.get('department_id')
        source_project_task_id = request.data.get('source_project_task_id')

        # Compatibility: check for singular employee_id
        if not employee_ids and request.data.get('employee_id'):
            employee_ids = [request.data.get('employee_id')]

        if not title:
            return Response({'error': 'title is required'}, status=400)

        # Allow admins to assign to anyone; employees can only assign to themselves.
        # For simplicity in multi-select, we'll keep this check for single employee for now if it's an employee creating it.
        if request.user.role != 'ADMIN':
            if not employee_ids or any(str(request.user.id) != str(eid) for eid in employee_ids):
                return Response({'error': 'You can only create tasks for yourself'}, status=403)

        assigned_employees = []
        for eid in employee_ids:
            try:
                assigned_employees.append(User.objects.get(id=eid))
            except DoesNotExist:
                continue

        project = None
        if project_id:
            try:
                project = Project.objects.get(id=project_id)
            except DoesNotExist:
                pass

        department = None
        if department_id:
            try:
                department = Department.objects.get(id=department_id)
            except DoesNotExist:
                pass

        task = Task(
            title=title, 
            description=description, 
            employees=assigned_employees, 
            project=project,
            department=department,
            source_project_task_id=source_project_task_id,
            status=request.data.get('status', 'BLOCKED'),
            is_archived=(request.data.get('status') == 'ARCHIVED' or request.data.get('is_archived', False))
        )
        task.save()

        # Sync with Project if linked
        if project:
            status_map = {'IN_PROGRESS': 'IN_PROGRESS', 'DONE': 'DONE'}
            p_status = status_map.get(task.status, 'TODO')
            
            p_task = ProjectTask(
                title=task.title,
                description=task.description or '',
                status=p_status
            )
            project.tasks.append(p_task)
            project.save()
            
            # Store the internal ID back to the main task
            task.source_project_task_id = str(p_task.id)
            task.save()

        return Response(serialize_task(task), status=201)


@api_view(['PATCH'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def update_task_status(request, pk):
    try:
        task = Task.objects.get(id=pk)
    except DoesNotExist:
        return Response({'error': 'Task not found'}, status=404)

    if request.user.role == 'EMPLOYEE' and not any(str(emp.id) == str(request.user.id) for emp in getattr(task, 'employees', [])):
        return Response({'error': 'You can only update tasks you are assigned to'}, status=403)

    status = request.data.get('status')
    if status is not None:
        if status not in ('BLOCKED', 'IN_PROGRESS', 'REVIEW', 'DONE', 'ARCHIVED'):
            return Response({'error': 'Invalid status. Must be BLOCKED, IN_PROGRESS, REVIEW, DONE, or ARCHIVED'}, status=400)
        task.status = status
        # Synchronize is_archived with status
        if status == 'ARCHIVED':
            task.is_archived = True
        else:
            task.is_archived = False

    if 'is_archived' in request.data:
        if request.user.role != 'ADMIN':
             return Response({'error': 'Only admins can archive tasks'}, status=403)
        is_archived = request.data['is_archived']
        task.is_archived = is_archived
        if is_archived:
            task.status = 'ARCHIVED'
    task.save()

    # Sync with Project status if linked
    if getattr(task, 'project', None) and getattr(task, 'source_project_task_id', None):
        try:
            proj = Project.objects.get(id=task.project.id)
            for pt in proj.tasks:
                if str(pt.id) == str(task.source_project_task_id):
                    status_map = {'IN_PROGRESS': 'IN_PROGRESS', 'DONE': 'DONE'}
                    pt.status = status_map.get(task.status, 'TODO')
                    if pt.status == 'DONE':
                        pt.completed_by = request.user
                        from datetime import datetime
                        pt.completed_at = datetime.utcnow()
                    break
            proj.save()
        except DoesNotExist:
            pass

    return Response(serialize_task(task))


@api_view(['PUT'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAdmin])
def update_task(request, pk):
    try:
        task = Task.objects.get(id=pk)
    except DoesNotExist:
        return Response({'error': 'Task not found'}, status=404)

    task.title = request.data.get('title', task.title)
    task.description = request.data.get('description', task.description)
    employee_ids = request.data.get('employee_ids', [])

    if employee_ids:
        assigned_employees = []
        for eid in employee_ids:
            try:
                assigned_employees.append(User.objects.get(id=eid))
            except DoesNotExist:
                continue
    task.save()

    # Sync metadata with Project
    if getattr(task, 'project', None) and getattr(task, 'source_project_task_id', None):
        try:
            proj = Project.objects.get(id=task.project.id)
            for pt in proj.tasks:
                if str(pt.id) == str(task.source_project_task_id):
                    pt.title = task.title
                    pt.description = task.description or ''
                    break
            proj.save()
        except DoesNotExist:
            pass

    return Response(serialize_task(task))

@api_view(['PATCH'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAdmin])
def archive_task_view(request, pk):
    try:
        task = Task.objects.get(id=pk)
    except DoesNotExist:
        return Response({'error': 'Task not found'}, status=404)
    
    task.is_archived = True
    task.save()
    return Response(serialize_task(task))

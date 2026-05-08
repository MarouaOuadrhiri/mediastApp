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
        if not emp:
            continue
        try:
            employee_data.append({
                'id': str(emp.id),
                'name': f"{getattr(emp, 'first_name', 'Unknown')} {getattr(emp, 'last_name', '')}".strip(),
                'photo': getattr(emp, 'profile_photo', '')
            })
        except Exception:
            continue

    # Fetch deadline and project name from linked ProjectTask
    deadline = t.deadline.strftime('%Y-%m-%d') if getattr(t, 'deadline', None) else None
    project_name = None
    if getattr(t, 'project', None):
        try:
            proj = t.project
            project_name = proj.name
            # Fallback to project deadline if no task-level deadline
            if not deadline and proj.deadline:
                deadline = proj.deadline.strftime('%Y-%m-%d')
        except Exception:
            pass

    # Ensure task's own deadline also uses the simple format if it was set
    if deadline and len(deadline) > 10:
        # If it was an ISO string from t.deadline.isoformat(), take first 10 chars
        deadline = deadline[:10]

    refused_by_name = None
    if getattr(t, 'refused_by', None):
        try:
            refused_by_name = f"{t.refused_by.first_name} {t.refused_by.last_name}"
        except Exception:
            pass

    return {
        'id': str(t.id),
        'title': t.title,
        'description': t.description or '',
        'status': t.status,
        'employees': employee_data,
        'project_id': str(t.project.id) if getattr(t, 'project', None) else None,
        'project_name': project_name,
        'department_id': str(t.department.id) if getattr(t, 'department', None) else None,
        'is_archived': getattr(t, 'is_archived', False),
        'deadline': deadline,
        'rejection_reason': getattr(t, 'rejection_reason', ''),
        'refusal_pending': getattr(t, 'refusal_pending', False),
        'refused_by': str(t.refused_by.id) if getattr(t, 'refused_by', None) else None,
        'refused_by_name': refused_by_name,
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
            status=request.data.get('status', 'BLOCKED'),
            is_archived=(request.data.get('status') == 'ARCHIVED' or request.data.get('is_archived', False))
        )
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
    rejection_reason = request.data.get('rejection_reason')
    refusal_pending = request.data.get('refusal_pending')
    
    if refusal_pending is not None:
        task.refusal_pending = refusal_pending
        if refusal_pending:
            task.refused_by = request.user
            if rejection_reason:
                task.rejection_reason = rejection_reason
        else:
            task.refused_by = None
            task.rejection_reason = ''

    if status is not None:
        if status not in ('BLOCKED', 'IN_PROGRESS', 'REVIEW', 'DONE', 'ARCHIVED'):
            return Response({'error': 'Invalid status. Must be BLOCKED, IN_PROGRESS, REVIEW, DONE, or ARCHIVED'}, status=400)
        task.status = status
        if status == 'BLOCKED' and rejection_reason:
            task.rejection_reason = rejection_reason
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
    task.status = request.data.get('status', task.status)
    task.priority = request.data.get('priority', task.priority)
    task.deadline = request.data.get('deadline', task.deadline)
    
    # Handle refusal flags
    if 'refusal_pending' in request.data:
        task.refusal_pending = request.data['refusal_pending']
    if 'rejection_reason' in request.data:
        task.rejection_reason = request.data['rejection_reason']
    if task.refusal_pending == False:
        task.refused_by = None

    employee_ids = request.data.get('employee_ids', [])
    if employee_ids:
        assigned_employees = []
        for eid in employee_ids:
            try:
                assigned_employees.append(User.objects.get(id=eid))
            except DoesNotExist:
                continue
        task.employees = assigned_employees

    project_id = request.data.get('project_id')
    if project_id:
        try:
            task.project = Project.objects.get(id=project_id)
        except DoesNotExist:
            pass
    elif 'project_id' in request.data:
        task.project = None

    department_id = request.data.get('department_id')
    if department_id:
        try:
            task.department = Department.objects.get(id=department_id)
        except DoesNotExist:
            pass
    elif 'department_id' in request.data:
        task.department = None

    task.save()
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

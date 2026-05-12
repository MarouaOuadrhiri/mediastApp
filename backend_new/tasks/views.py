from rest_framework.decorators import api_view, authentication_classes, permission_classes
import datetime
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from users.authentication import JWTAuthentication
from users.permissions import IsAdmin
from users.models import User
from .models import Task
from projects.models import Project, ProjectTask
from departments.models import Department
from mongoengine.errors import DoesNotExist


def serialize_project_task(pt, project):
    """Serialize a ProjectTask embedded document to look like a Task."""
    assigned_to_data = []
    if pt.assigned_to:
        assigned_to_data.append({
            'id': str(pt.assigned_to.id),
            'name': f"{pt.assigned_to.first_name} {pt.assigned_to.last_name}".strip(),
            'photo': pt.assigned_to.profile_photo or ''
        })

    deadline = pt.deadline.strftime('%Y-%m-%d') if pt.deadline else None

    return {
        'id': f"{project.id}:{pt.id}",  # Compound ID for easy lookup
        'title': pt.title,
        'description': pt.description or '',
        'status': pt.status,
        'employees': assigned_to_data,
        'project_id': str(project.id),
        'project_name': project.name,
        'is_project_task': True,
        'deadline': deadline,
        'rejection_reason': getattr(pt, 'rejection_reason', ''),
        'refusal_pending': getattr(pt, 'refusal_pending', False),
        'refused_by': str(pt.refused_by.id) if getattr(pt, 'refused_by', None) else None,
    }

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
    raw_deadline = getattr(t, 'deadline', None)
    deadline = None
    if raw_deadline:
        if isinstance(raw_deadline, str):
            deadline = raw_deadline[:10]
        else:
            deadline = raw_deadline.strftime('%Y-%m-%d')
    
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
            standalone_tasks = Task.objects()
            projects = Project.objects()
        else:
            standalone_tasks = Task.objects(employees=request.user, is_archived=False)
            # Find projects where user is either in team or assigned to a task
            projects = Project.objects(employees=request.user)
            # Also find projects where they have assigned tasks but might not be in project.employees
            # (Though our logic usually adds them to project.employees)

        results = [serialize_task(t) for t in standalone_tasks]
        
        # Include ProjectTasks
        for p in projects:
            if p.tasks:
                for pt in p.tasks:
                    # Filter for employees: only show if assigned to them AND not archived
                    if request.user.role == 'ADMIN':
                        results.append(serialize_project_task(pt, p))
                    elif (pt.assigned_to and str(pt.assigned_to.id) == str(request.user.id)):
                        if not getattr(pt, 'is_archived', False):
                            results.append(serialize_project_task(pt, p))
        
        return Response(results)

    if request.method == 'POST':
        title = request.data.get('title')
        description = request.data.get('description', '')
        employee_ids = request.data.get('employee_ids', [])
        department_id = request.data.get('department_id')
        project_id = request.data.get('project_id')

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

        if project_id:
            try:
                project = Project.objects.get(id=project_id)
                
                # Create a ProjectTask embedded document
                pt = ProjectTask(
                    title=title,
                    description=description,
                    status=request.data.get('status', 'TODO'),
                    assigned_to=assigned_employees[0] if assigned_employees else None
                )
                
                if not project.tasks:
                    project.tasks = []
                project.tasks.append(pt)
                
                # Also ensure the assigned employee is in the project team
                if assigned_employees:
                    for emp in assigned_employees:
                        if emp not in project.employees:
                            project.employees.append(emp)
                
                project.save()
                return Response(serialize_project_task(pt, project), status=201)
            except DoesNotExist:
                return Response({'error': 'Project not found'}, status=404)

        task = Task(
            title=title, 
            description=description, 
            employees=assigned_employees, 
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
    # Check if it's a ProjectTask (compound ID)
    if ':' in pk:
        project_id, task_id = pk.split(':')
        try:
            project = Project.objects.get(id=project_id)
            task = next((t for t in project.tasks if str(t.id) == task_id), None)
            if not task:
                return Response({'error': 'Project task not found'}, status=404)
            
            # Permission check
            if request.user.role == 'EMPLOYEE' and (not task.assigned_to or str(task.assigned_to.id) != str(request.user.id)):
                return Response({'error': 'You can only update tasks you are assigned to'}, status=403)

            status = request.data.get('status')
            if status:
                task.status = status
                if status == 'DONE':
                    task.completed_at = datetime.datetime.utcnow()
                    task.completed_by = request.user
            
            if 'refusal_pending' in request.data:
                task.refusal_pending = request.data['refusal_pending']
                if task.refusal_pending:
                    task.refused_by = request.user
                    task.rejection_reason = request.data.get('rejection_reason', '')
                else:
                    task.refused_by = None
                    task.rejection_reason = ''

            project.save()
            return Response(serialize_project_task(task, project))
        except DoesNotExist:
            return Response({'error': 'Project not found'}, status=404)

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
    # Handle ProjectTask
    if ':' in pk:
        project_id, task_id = pk.split(':')
        try:
            project = Project.objects.get(id=project_id)
            task = next((t for t in project.tasks if str(t.id) == task_id), None)
            if not task:
                return Response({'error': 'Project task not found'}, status=404)

            task.title = request.data.get('title', task.title)
            task.description = request.data.get('description', task.description)
            task.status = request.data.get('status', task.status)
            task.deadline = request.data.get('deadline', task.deadline)
            
            employee_ids = request.data.get('employee_ids', [])
            if employee_ids:
                try:
                    task.assigned_to = User.objects.get(id=employee_ids[0])
                except DoesNotExist:
                    pass

            project.save()
            return Response(serialize_project_task(task, project))
        except DoesNotExist:
            return Response({'error': 'Project not found'}, status=404)

    try:
        task = Task.objects.get(id=pk)
    except DoesNotExist:
        return Response({'error': 'Task not found'}, status=404)

    task.title = request.data.get('title', task.title)
    task.description = request.data.get('description', task.description)
    task.status = request.data.get('status', task.status)
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
    # Handle ProjectTask
    if ':' in pk:
        project_id, task_id = pk.split(':')
        try:
            project = Project.objects.get(id=project_id)
            task = next((t for t in project.tasks if str(t.id) == task_id), None)
            if not task:
                return Response({'error': 'Project task not found'}, status=404)
            
            task.is_archived = True
            project.save()
            return Response(serialize_project_task(task, project))
        except DoesNotExist:
            return Response({'error': 'Project not found'}, status=404)

    try:
        task = Task.objects.get(id=pk)
    except DoesNotExist:
        return Response({'error': 'Task not found'}, status=404)
    
    task.is_archived = True
    task.save()
    return Response(serialize_task(task))

from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from users.authentication import JWTAuthentication
from users.permissions import IsAdmin
from users.models import User
from .models import Task
from mongoengine.errors import DoesNotExist


def serialize_task(t):
    try:
        employee_id = str(t.employee.id) if t.employee else None
        employee_name = t.employee.username if t.employee else "Unknown Member"
        employee_photo = getattr(t.employee, 'profile_photo', '') if t.employee else ""
    except DoesNotExist:
        employee_id = None
        employee_name = "Unknown Member (Deleted)"

    return {
        'id': str(t.id),
        'title': t.title,
        'description': t.description or '',
        'status': t.status,
        'employee_id': employee_id,
        'employee_name': employee_name,
        'employee_photo': employee_photo,
        'source_project_task_id': getattr(t, 'source_project_task_id', None),
    }


@api_view(['GET', 'POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def task_list_create(request):
    if request.method == 'GET':
        tasks = Task.objects.all() if request.user.role == 'ADMIN' else Task.objects(employee=request.user)
        return Response([serialize_task(t) for t in tasks])

    if request.method == 'POST':
        title = request.data.get('title')
        description = request.data.get('description', '')
        employee_id = request.data.get('employee_id')
        source_project_task_id = request.data.get('source_project_task_id')

        # Restriction: Employees can ONLY create a task from a note
        if request.user.role == 'EMPLOYEE' and not source_project_task_id:
            return Response({'error': 'You can only create tasks from an admin note.'}, status=403)

        # Allow admins to assign to anyone; employees can only assign to themselves.
        if request.user.role != 'ADMIN':
            if not employee_id or str(request.user.id) != str(employee_id):
                return Response({'error': 'You can only create tasks for yourself'}, status=403)
        
        if not title or not employee_id:
            return Response({'error': 'title and employee_id are required'}, status=400)

        # Enforce one task per source project task
        if source_project_task_id:
            if Task.objects(employee=request.user, source_project_task_id=source_project_task_id).first():
                return Response({'error': 'You have already created a standalone task for this note.'}, status=400)

        try:
            employee = User.objects.get(id=employee_id, role='EMPLOYEE')
        except DoesNotExist:
            return Response({'error': 'Employee not found'}, status=404)

        task = Task(title=title, description=description, employee=employee, source_project_task_id=source_project_task_id)
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

    if request.user.role == 'EMPLOYEE' and str(task.employee.id) != str(request.user.id):
        return Response({'error': 'You can only update your own tasks'}, status=403)

    status = request.data.get('status')
    if status not in ('BLOCKED', 'IN_PROGRESS', 'REVIEW', 'DONE'):
        return Response({'error': 'Invalid status. Must be BLOCKED, IN_PROGRESS, REVIEW, or DONE'}, status=400)

    task.status = status
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
    employee_id = request.data.get('employee_id')

    if employee_id:
        try:
            task.employee = User.objects.get(id=employee_id, role='EMPLOYEE')
        except DoesNotExist:
            return Response({'error': 'Employee not found'}, status=404)

    task.save()
    return Response(serialize_task(task))

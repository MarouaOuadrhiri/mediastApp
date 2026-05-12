from django.shortcuts import render
from django.http import JsonResponse
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .authentication import JWTAuthentication
from .models import User, AttendanceRecord, UserSession
from django.contrib.auth.hashers import make_password, check_password
import jwt
import datetime
from django.conf import settings
from mongoengine import NotUniqueError
from mongoengine.errors import DoesNotExist
from departments.models import Department
from .permissions import IsAdmin


def serialize_user(u, include_department=True):
    """Consistent user serialization with dynamic profile metrics."""
    from projects.models import Project
    import datetime

    is_online = False
    current_session_start = None
    total_seconds_today = 0
    now = datetime.datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # 1. Online Status & Today's Work
    records = AttendanceRecord.objects(user=u, start_time__gte=today_start)
    for r in records:
        if r.status == 'COMPLETED' and r.end_time:
            delta = r.end_time - r.start_time
            total_seconds_today += delta.total_seconds()

    active_session = AttendanceRecord.objects(user=u, status='ACTIVE').first()
    if active_session:
        is_online = True
        current_session_start = active_session.start_time.isoformat() + 'Z'

    # 2. Tenure Calculation
    created_at = getattr(u, 'created_at', now)
    tenure_delta = now - created_at
    tenure_years = tenure_delta.days // 365
    tenure_months = (tenure_delta.days % 365) // 30
    if tenure_years > 0:
        tenure_str = f"{tenure_years}.{tenure_months} Years"
    else:
        tenure_str = f"{tenure_months} Months"

    # 3. Project & Task Metrics
    projects = Project.objects(employees=u.id)
    ongoing_projects = projects.filter(status__in=['IN_PROGRESS', 'TODO'])
    
    all_assigned_tasks = []
    completed_tasks = []
    for p in projects:
        for t in p.tasks:
            if str(getattr(t, 'assigned_to', '')) == str(u.id):
                all_assigned_tasks.append(t)
                if t.status == 'DONE':
                    completed_tasks.append(t)

    total_tasks = len(all_assigned_tasks)
    done_tasks = len(completed_tasks)
    
    efficiency = 0
    if total_tasks > 0:
        efficiency = round((done_tasks / total_tasks) * 100)
    
    global_points = done_tasks * 15 # Mocked point system: 15pts per task
    
    # Sprint Load: active tasks / capacity (e.g. 10 tasks capacity)
    active_tasks = total_tasks - done_tasks
    sprint_load = min(round((active_tasks / 8) * 100), 100) if total_tasks > 0 else 0
    
    # 4. Weekly Hours (Last 7 days)
    week_start = today_start - datetime.timedelta(days=6)
    week_records = AttendanceRecord.objects(user=u, start_time__gte=week_start)
    total_week_seconds = sum([(r.end_time - r.start_time).total_seconds() for r in week_records if r.end_time])
    weekly_hours = round(total_week_seconds / 3600, 1)

    # 5. Milestones (Upcoming 3 tasks)
    milestones = []
    upcoming_tasks = [t for t in all_assigned_tasks if t.status != 'DONE']
    # Sort by deadline if exists
    upcoming_tasks.sort(key=lambda x: getattr(x, 'deadline', datetime.datetime.max))
    for t in upcoming_tasks[:3]:
        deadline = getattr(t, 'deadline', None)
        date_str = deadline.strftime('%b %d') if deadline else 'TBD'
        milestones.append({
            'date': date_str,
            'title': t.title,
            'project': 'Project: Active', # Simplified
            'current': (deadline - now).days < 2 if deadline else False
        })

    # 6. Portfolio (Last 2 completed tasks)
    portfolio = []
    for t in completed_tasks[-2:]:
        # Use a default project image or task image if available
        portfolio.append({
            'image': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&h=300'
        })

    def format_seconds(s):
        h = int(s // 3600)
        m = int((s % 3600) // 60)
        s = int(s % 60)
        return f"{h:02d}:{m:02d}:{s:02d}"

    data = {
        'id': str(u.id),
        'email': u.email,
        'first_name': getattr(u, 'first_name', ''),
        'last_name': getattr(u, 'last_name', ''),
        'role': u.role,
        'profile_photo': getattr(u, 'profile_photo', ''),
        'bio': getattr(u, 'bio', ''),
        'skills': getattr(u, 'skills', []),
        'is_online': is_online,
        'current_session_start': current_session_start,
        'total_work_today': format_seconds(total_seconds_today),
        'preferences': getattr(u, 'preferences', {}),
        'stats': {
            'tenure': tenure_str,
            'ongoing_projects_count': len(ongoing_projects),
            'global_points': global_points,
            'efficiency': efficiency,
            'feedback': 4.9, # Static for now
            'sprint_load': sprint_load,
            'weekly_hours': weekly_hours,
            'lead_time': 1.4, # Static for now
            'milestones': milestones,
            'portfolio': portfolio
        }
    }
    
    if include_department:
        try:
            if u.department:
                data['department_id'] = str(u.department.id)
                data['department_name'] = u.department.name
        except:
            pass
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
            profile_photo=data.get('profile_photo', ''),
            bio=data.get('bio', '')
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

    # Start attendance session
    AttendanceRecord.objects(user=user, status='ACTIVE').update(
        set__end_time=datetime.datetime.utcnow(),
        set__status='COMPLETED'
    )
    AttendanceRecord(
        user=user,
        start_time=datetime.datetime.utcnow(),
        status='ACTIVE'
    ).save()

    # Track Device Session
    user_agent = request.headers.get('User-Agent', 'Unknown Device')
    ip = request.META.get('REMOTE_ADDR')
    UserSession(
        user=user,
        token=token,
        device_info=user_agent,
        ip_address=ip
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
    if request.method == 'GET':
        return Response(serialize_user(request.user))

    if request.method == 'PATCH':
        user = request.user
        data = request.data
        current_password = data.get('current_password', '').strip()

        if not current_password:
            return Response({'error': 'current_password is required to update your profile.'}, status=400)
        if not check_password(current_password, user.password):
            return Response({'error': 'Current password is incorrect.'}, status=400)

        if 'first_name' in data: user.first_name = data.get('first_name')
        if 'last_name' in data: user.last_name = data.get('last_name')
        if 'email' in data:
            new_email = data.get('email')
            if new_email != user.email:
                if User.objects(email=new_email).first():
                    return Response({'error': 'Email already in use.'}, status=400)
                user.email = new_email
        if 'password' in data:
            new_pw = data.get('password')
            if len(new_pw) < 6:
                return Response({'error': 'New password must be at least 6 characters.'}, status=400)
            user.password = make_password(new_pw)
        if 'profile_photo' in data: user.profile_photo = data.get('profile_photo')
        if 'bio' in data: user.bio = data.get('bio')
        if 'preferences' in data: user.preferences = data.get('preferences')

        try:
            user.save()
        except NotUniqueError:
            return Response({'error': 'Email address already exists.'}, status=400)

        return Response({'message': 'Profile updated successfully.', 'user': serialize_user(user)})

@api_view(['PATCH'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def update_preferences(request):
    user = request.user
    data = request.data
    if 'preferences' in data:
        user.preferences = data.get('preferences', {})
        user.save()
        return Response({'message': 'Preferences saved.', 'preferences': user.preferences})
    return Response({'error': 'No preferences provided.'}, status=400)

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def my_team(request):
    user = request.user
    if not user.department:
        return Response([serialize_user(user)])
    team = User.objects(department=user.department)
    return Response([serialize_user(u) for u in team])


@api_view(['GET', 'POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAdmin])
def employee_list_create(request):
    if request.method == 'GET':
        employees = User.objects(role='EMPLOYEE')
        from projects.models import Project
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
                    if getattr(t, 'assigned_to', None) and str(t.assigned_to.id) == str(uid):
                        total_tasks += 1
                        if t.status == 'DONE':
                            done_tasks += 1
            
            progress = int((done_tasks / total_tasks) * 100) if total_tasks > 0 else 0
            active_tasks = total_tasks - done_tasks
            status = "Available" if active_tasks == 0 else "Busy" if active_tasks <= 5 else "At Capacity"
                
            data['workload_progress'] = progress
            data['workload_status'] = status
            data['active_tasks'] = active_tasks
            response_data.append(data)
            
        return Response(response_data)

    if request.method == 'POST':
        data = request.data
        email = data.get('email')
        password = data.get('password')
        department_id = data.get('department_id')

        if not email or not password or not department_id:
            return Response({'error': 'email, password, and department_id are required'}, status=400)

        try:
            dep = Department.objects.get(id=department_id)
            user = User(
                email=email,
                password=make_password(password),
                first_name=data.get('first_name', ''),
                last_name=data.get('last_name', ''),
                role='EMPLOYEE',
                department=dep,
                profile_photo=data.get('profile_photo', ''),
                bio=data.get('bio', '')
            )
            user.save()
            return Response({'message': 'Employee created successfully', 'user': serialize_user(user)}, status=201)
        except DoesNotExist:
            return Response({'error': 'Department not found'}, status=404)
        except NotUniqueError:
            return Response({'error': 'Email address already exists'}, status=400)


@api_view(['GET', 'PATCH', 'DELETE'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def employee_detail(request, pk):
    try:
        employee = User.objects.get(id=pk)
    except DoesNotExist:
        return Response({'error': 'User not found'}, status=404)

    if request.method == 'GET':
        return Response(serialize_user(employee))

    if request.method == 'PATCH':
        if request.user.role == 'EMPLOYEE' and str(request.user.id) != str(employee.id):
            return Response({'error': 'You can only update your own profile.'}, status=403)

        data = request.data
        if request.user.role == 'EMPLOYEE':
            current_password = data.get('current_password', '').strip()
            if not current_password or not check_password(current_password, employee.password):
                return Response({'error': 'Valid current_password is required.'}, status=400)

        if 'first_name' in data: employee.first_name = data.get('first_name')
        if 'last_name' in data: employee.last_name = data.get('last_name')
        if 'email' in data:
            new_email = data.get('email')
            if new_email != employee.email:
                if User.objects(email=new_email).first():
                    return Response({'error': 'Email already in use.'}, status=400)
                employee.email = new_email
        if 'password' in data:
            employee.password = make_password(data.get('password'))
        if 'profile_photo' in data: employee.profile_photo = data.get('profile_photo')
        if 'bio' in data: employee.bio = data.get('bio')
        if 'department_id' in data and request.user.role == 'ADMIN':
            try:
                employee.department = Department.objects.get(id=data.get('department_id'))
            except DoesNotExist:
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
@permission_classes([IsAuthenticated])
def get_employee_history(request, pk):
    if request.user.role != 'ADMIN' and str(request.user.id) != str(pk):
        return Response({'error': 'You can only view your own history.'}, status=403)

    try:
        uid = ObjectId(pk)
        user = User.objects.get(id=uid)
    except:
        return Response({'error': 'User not found'}, status=404)

    from projects.models import Project
    from mongoengine.queryset.visitor import Q

    filters = [Q(employees=uid), Q(tasks__completed_by=uid)]
    if user.department:
        filters.append(Q(department=user.department.id))
    
    query = filters[0]
    for q in filters[1:]:
        query |= q

    projects = Project.objects.filter(query).order_by('-start_date')

    project_data = []
    for p in projects:
        user_tasks = [t for t in p.tasks if getattr(t, 'assigned_to', None) and str(t.assigned_to.id) == str(uid)]
        total_tasks = len(user_tasks)
        done_tasks = len([t for t in user_tasks if t.status == 'DONE'])
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
                    'completed_at': t.completed_at.isoformat() if getattr(t, 'completed_at', None) else None,
                    'progress': 100 if t.status == 'DONE' else 50 if t.status == 'IN_PROGRESS' else 0,
                    'completed_by_name': f"{user.first_name} {user.last_name}" if (getattr(t, 'completed_by', None) and str(t.completed_by.id) == str(uid)) else (f"{t.completed_by.first_name} {t.completed_by.last_name}" if getattr(t, 'completed_by', None) else None)
                } for t in user_tasks
            ]
        })

    return Response({
        'user': serialize_user(user),
        'projects': project_data,
        'standalone_tasks': [] # No longer used
    })


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def end_attendance(request):
    AttendanceRecord.objects(user=request.user, status='ACTIVE').update(
        set__end_time=datetime.datetime.utcnow(),
        set__status='COMPLETED'
    )
    return Response({'message': 'Attendance session ended.'})

@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def start_attendance(request):
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
    try:
        user = User.objects.get(id=pk)
    except:
        return Response({'error': 'User not found'}, status=404)
    logs = AttendanceRecord.objects(user=user).order_by('-start_time')
    return Response([{
        'id': str(l.id),
        'start_time': l.start_time.isoformat() + 'Z',
        'end_time': (l.end_time.isoformat() + 'Z') if l.end_time else None,
        'status': l.status,
        'duration': str(l.end_time - l.start_time).split('.')[0] if l.end_time else 'Active'
    } for l in logs])


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAdmin])
def activity_heatmap(request):
    counts = [0] * 24
    for record in AttendanceRecord.objects():
        hour = record.start_time.hour
        counts[hour] += 1
    max_count = max(counts) if max(counts) > 0 else 1
    def to_level(c):
        if c == 0: return 0
        ratio = c / max_count
        if ratio < 0.33: return 1
        if ratio < 0.66: return 2
        return 3
    return Response({'hourly': [to_level(c) for c in counts], 'raw': counts})

@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def verify_password(request):
    password = request.data.get('password')
    if not password:
        return Response({'error': 'Password is required'}, status=400)
    if check_password(password, request.user.password):
        return Response({'success': True})
    return Response({'success': False, 'error': 'Incorrect password'}, status=401)

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def get_user_sessions(request):
    sessions = UserSession.objects(user=request.user, is_active=True).order_by('-created_at')
    return Response([{
        'id': str(s.id),
        'device_info': s.device_info,
        'ip_address': s.ip_address,
        'created_at': s.created_at.isoformat() + 'Z',
        'is_current': s.token == request.auth
    } for s in sessions])

@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def revoke_session(request):
    session_id = request.data.get('session_id')
    if not session_id:
        return Response({'error': 'session_id is required'}, status=400)
    try:
        session = UserSession.objects.get(id=session_id, user=request.user)
        session.is_active = False
        session.save()
        return Response({'message': 'Session revoked successfully'})
    except DoesNotExist:
        return Response({'error': 'Session not found'}, status=404)

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from users.authentication import JWTAuthentication
from users.permissions import IsAdmin
from .models import Meeting
from users.models import User
from departments.models import Department
from bson import ObjectId
from bson.errors import InvalidId
import datetime

class CreateMeetingView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdmin]
    
    def post(self, request):
        data = request.data
        try:
            title = data.get('title', '').strip()
            description = data.get('description', '').strip()
            date_time_str = data.get('date_time', '')
            department_ids = data.get('departments', [])
            employee_ids = data.get('employees', [])

            if not title:
                return Response({'error': 'Meeting title is required.'}, status=status.HTTP_400_BAD_REQUEST)
            if not date_time_str:
                return Response({'error': 'Date and time are required.'}, status=status.HTTP_400_BAD_REQUEST)

            # Parse ISO date string robustly — strip trailing Z and handle offset
            try:
                clean_str = date_time_str.strip()
                if clean_str.endswith('Z'):
                    clean_str = clean_str[:-1] + '+00:00'
                date_time = datetime.datetime.fromisoformat(clean_str)
                # Make naive UTC (strip tzinfo) for MongoEngine DateTimeField
                date_time = date_time.replace(tzinfo=None)
            except (ValueError, TypeError) as e:
                return Response({'error': f'Invalid date format: {str(e)}. Use ISO format (e.g. 2026-04-07T10:00:00Z).'}, status=status.HTTP_400_BAD_REQUEST)
            
            meeting = Meeting(
                title=title,
                description=description,
                date_time=date_time,
                created_by=request.user
            )

            # Safely resolve departments by ObjectId
            if department_ids:
                deps = []
                for dep_id in department_ids:
                    try:
                        deps.append(Department.objects.get(id=ObjectId(dep_id)))
                    except (InvalidId, Department.DoesNotExist, Exception):
                        pass  # Skip invalid/unknown IDs gracefully
                meeting.departments = deps

            # Safely resolve employees by ObjectId
            if employee_ids:
                emps = []
                for emp_id in employee_ids:
                    try:
                        emps.append(User.objects.get(id=ObjectId(emp_id)))
                    except (InvalidId, User.DoesNotExist, Exception):
                        pass  # Skip invalid/unknown IDs gracefully
                meeting.employees = emps

            meeting.save()
            return Response({'message': 'Meeting created successfully.', 'id': str(meeting.id)}, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({'error': f'Failed to create meeting: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)


class ListMeetingsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            if request.user.role == 'ADMIN':
                meetings = Meeting.objects.all().order_by('-date_time')
            else:
                from mongoengine.queryset.visitor import Q
                q = Q(employees=request.user)
                if request.user.department:
                    q |= Q(departments=request.user.department)
                meetings = Meeting.objects(q).order_by('-date_time')
            
            result = []
            for m in meetings:
                try:
                    # Format date safely — avoid double-timezone suffix
                    dt_str = m.date_time.strftime('%Y-%m-%dT%H:%M:%SZ') if m.date_time else None
                    created_by_name = m.created_by.username if m.created_by else 'Unknown'
                    result.append({
                        'id': str(m.id),
                        'title': m.title,
                        'description': m.description or '',
                        'date_time': dt_str,
                        'departments': [{'id': str(d.id), 'name': d.name} for d in (m.departments or [])],
                        'employees': [{'id': str(e.id), 'name': e.username} for e in (m.employees or [])],
                        'created_by': created_by_name,
                    })
                except Exception:
                    continue  # Skip malformed records

            return Response(result)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

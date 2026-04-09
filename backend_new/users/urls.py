from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
    path('protected/', views.protected_view, name='protected_view'),
    path('me/', views.me_view, name='me_view'),
    path('employees/', views.employee_list_create, name='employee_list_create'),
    path('employees/<str:pk>/', views.employee_detail, name='employee_detail'),
    path('employees/<str:pk>/history/', views.get_employee_history, name='employee_history'),
    path('employees/<str:pk>/attendance/', views.get_employee_attendance_logs, name='employee_attendance_logs'),
    path('attendance/start/', views.start_attendance, name='start_attendance'),
    path('attendance/end/', views.end_attendance, name='end_attendance'),
    path('attendance/current/', views.get_current_attendance, name='get_current_attendance'),
]

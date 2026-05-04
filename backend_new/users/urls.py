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
    path('activity-heatmap/', views.activity_heatmap, name='activity_heatmap'),
    path('my-team/', views.my_team, name='my_team'),
    path('me/preferences/', views.update_preferences, name='update_preferences'),
    path('me/sessions/', views.get_user_sessions, name='get_user_sessions'),
    path('me/sessions/revoke/', views.revoke_session, name='revoke_session'),
    path('verify-password/', views.verify_password, name='verify_password'),
]

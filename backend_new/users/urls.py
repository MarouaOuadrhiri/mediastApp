from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
    path('protected/', views.protected_view, name='protected_view'),
    path('me/', views.me_view, name='me_view'),
    path('employees/', views.employee_list_create, name='employee_list_create'),
    path('employees/<str:pk>/', views.employee_detail, name='employee_detail'),
]

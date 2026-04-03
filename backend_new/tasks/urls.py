from django.urls import path
from . import views

urlpatterns = [
    path('', views.task_list_create, name='task_list_create'),
    path('<str:pk>/', views.update_task, name='update_task'),
    path('<str:pk>/status/', views.update_task_status, name='update_task_status'),
]

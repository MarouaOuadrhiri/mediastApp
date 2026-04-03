from django.urls import path
from . import views

urlpatterns = [
    path('', views.project_list_create, name='project-list-create'),
    path('my/', views.my_projects, name='my-projects'),
    path('<str:pk>/', views.project_detail, name='project-detail'),
    path('<str:pk>/tasks/<str:task_id>/status/', views.update_project_task_status, name='update-project-task-status'),
]

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('users.urls')),
    path('api/tasks/', include('tasks.urls')),
    path('api/departments/', include('departments.urls')),
    path('api/projects/', include('projects.urls')),
    path('api/meetings/', include('meetings.urls')),
]

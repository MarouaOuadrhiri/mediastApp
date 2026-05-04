from django.urls import path
from . import views

urlpatterns = [
    path('', views.discussion_list_create, name='discussion_list_create'),
]

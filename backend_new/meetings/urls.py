from django.urls import path
from .views import CreateMeetingView, ListMeetingsView

urlpatterns = [
    path('', ListMeetingsView.as_view(), name='meeting-list'),
    path('create/', CreateMeetingView.as_view(), name='meeting-create'),
]

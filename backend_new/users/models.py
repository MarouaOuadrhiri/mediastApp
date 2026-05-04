from django.db import models
import datetime

# Create your models here.
# users/models.py
from mongoengine import Document, StringField, EmailField, ReferenceField, DateTimeField, DictField, BooleanField
from departments.models import Department

class User(Document):
    email = EmailField(required=True, unique=True)
    password = StringField(required=True)
    first_name = StringField(max_length=50)
    last_name = StringField(max_length=50)
    role = StringField(choices=('ADMIN', 'EMPLOYEE'), default='EMPLOYEE')
    department = ReferenceField(Department, null=True)
    profile_photo = StringField()
    bio = StringField()
    preferences = DictField()
    
    meta = {
        'strict': False,
        'collection': 'user'
    }

    @property
    def is_authenticated(self):
        return True

class UserSession(Document):
    user = ReferenceField(User, required=True)
    token = StringField(required=True)
    device_info = StringField()
    ip_address = StringField()
    created_at = DateTimeField(default=datetime.datetime.utcnow)
    last_active = DateTimeField(default=datetime.datetime.utcnow)
    is_active = BooleanField(default=True)

    meta = {
        'collection': 'user_sessions',
        'indexes': ['token', 'user']
    }

class AttendanceRecord(Document):
    user = ReferenceField(User, required=True)
    start_time = DateTimeField(required=True)
    end_time = DateTimeField()
    status = StringField(choices=('ACTIVE', 'COMPLETED'), default='ACTIVE')
from django.db import models

# Create your models here.
# users/models.py
from mongoengine import Document, StringField, EmailField, ReferenceField, DateTimeField
from departments.models import Department

class User(Document):
    email = EmailField(required=True, unique=True)
    password = StringField(required=True)
    first_name = StringField(max_length=50)
    last_name = StringField(max_length=50)
    role = StringField(choices=('ADMIN', 'EMPLOYEE'), default='EMPLOYEE')
    department = ReferenceField(Department, null=True)
    profile_photo = StringField()
    
    meta = {
        'strict': False,
        'collection': 'user'
    }

    @property
    def is_authenticated(self):
        return True

class AttendanceRecord(Document):
    user = ReferenceField(User, required=True)
    start_time = DateTimeField(required=True)
    end_time = DateTimeField()
    status = StringField(choices=('ACTIVE', 'COMPLETED'), default='ACTIVE')
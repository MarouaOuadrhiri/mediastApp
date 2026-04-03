from django.db import models

# Create your models here.
# users/models.py
from mongoengine import Document, StringField, EmailField, ReferenceField
from departments.models import Department

class User(Document):
    username = StringField(required=True, max_length=50, unique=True)
    email = EmailField(required=True, unique=True)
    password = StringField(required=True)
    role = StringField(choices=('ADMIN', 'EMPLOYEE'), default='EMPLOYEE')
    department = ReferenceField(Department, null=True)

    @property
    def is_authenticated(self):
        return True
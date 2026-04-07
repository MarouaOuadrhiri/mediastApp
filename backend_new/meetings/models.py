from mongoengine import Document, StringField, ReferenceField, ListField, DateTimeField
from users.models import User
from departments.models import Department
import datetime

class Meeting(Document):
    title = StringField(required=True, max_length=200)
    description = StringField()
    date_time = DateTimeField(required=True)
    departments = ListField(ReferenceField(Department))
    employees = ListField(ReferenceField(User))
    created_by = ReferenceField(User, required=True)
    created_at = DateTimeField(default=datetime.datetime.utcnow)

    meta = {'collection': 'meetings'}

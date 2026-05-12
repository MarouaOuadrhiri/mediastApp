from mongoengine import Document, StringField, ReferenceField, BooleanField, ListField, DateTimeField
from users.models import User

class Task(Document):
    STATUS_CHOICES = ('BLOCKED', 'IN_PROGRESS', 'REVIEW', 'DONE', 'ARCHIVED')
    
    title = StringField(required=True, max_length=200)
    description = StringField()
    status = StringField(choices=STATUS_CHOICES, default='BLOCKED')
    deadline = DateTimeField()
    employees = ListField(ReferenceField(User))
    department = ReferenceField('Department', null=True)
    is_archived = BooleanField(default=False)
    rejection_reason = StringField()  # For task rejection flow
    refusal_pending = BooleanField(default=False)
    refused_by = ReferenceField(User, null=True)
    
    meta = {
        'collection': 'tasks',
        'strict': False
    }

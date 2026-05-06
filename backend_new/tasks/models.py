from mongoengine import Document, StringField, ReferenceField, BooleanField, ListField, DateTimeField
from users.models import User

class Task(Document):
    STATUS_CHOICES = ('BLOCKED', 'IN_PROGRESS', 'REVIEW', 'DONE', 'ARCHIVED')
    
    title = StringField(required=True, max_length=200)
    description = StringField()
    status = StringField(choices=STATUS_CHOICES, default='BLOCKED')
    deadline = DateTimeField()
    employees = ListField(ReferenceField(User))
    project = ReferenceField('Project', null=True)
    department = ReferenceField('Department', null=True)
    source_project_task_id = StringField()
    is_archived = BooleanField(default=False)
    deadline = DateTimeField()
    rejection_reason = StringField()  # For task rejection flow
    
    meta = {'collection': 'tasks'}

from mongoengine import Document, StringField, ReferenceField, BooleanField
from users.models import User

class Task(Document):
    STATUS_CHOICES = ('BLOCKED', 'IN_PROGRESS', 'REVIEW', 'DONE', 'ARCHIVED')
    
    title = StringField(required=True, max_length=200)
    description = StringField()
    status = StringField(choices=STATUS_CHOICES, default='BLOCKED')
    employee = ReferenceField(User, required=True)
    source_project_task_id = StringField()
    is_archived = BooleanField(default=False)

from mongoengine import Document, StringField, ReferenceField
from users.models import User

class Task(Document):
    STATUS_CHOICES = ('TODO', 'IN_PROGRESS', 'DONE')
    
    title = StringField(required=True, max_length=200)
    description = StringField()
    status = StringField(choices=STATUS_CHOICES, default='TODO')
    employee = ReferenceField(User, required=True)

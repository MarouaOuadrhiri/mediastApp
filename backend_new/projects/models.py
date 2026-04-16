from mongoengine import Document, StringField, ReferenceField, ListField, EmbeddedDocument, EmbeddedDocumentField, ObjectIdField, DateTimeField, BooleanField
from users.models import User
from departments.models import Department
import bson
import datetime

class ProjectTask(EmbeddedDocument):
    id = ObjectIdField(default=bson.ObjectId)
    title = StringField(required=True, max_length=200)
    description = StringField()
    note = StringField()
    status = StringField(choices=('TODO', 'IN_PROGRESS', 'DONE'), default='TODO')
    deadline = DateTimeField()
    completed_by = ReferenceField(User, null=True)
    completed_at = DateTimeField()

class Project(Document):
    meta = {'strict': False}
    name = StringField(required=True, max_length=200)
    client = StringField(max_length=200)
    description = StringField()
    owner = StringField(max_length=200, null=True)
    status = StringField(choices=('Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled'), default='Planning')
    priority = StringField(choices=('LOW', 'MEDIUM', 'HIGH', 'URGENT'), default='MEDIUM')
    is_high_priority = BooleanField(default=False)
    budget = StringField(max_length=100)
    duration = StringField(max_length=100)
    tags = ListField(StringField())
    employees = ListField(ReferenceField(User))
    department = ReferenceField(Department, null=True)
    start_date = DateTimeField(default=datetime.datetime.utcnow)
    deadline = DateTimeField()
    tasks = ListField(EmbeddedDocumentField(ProjectTask))

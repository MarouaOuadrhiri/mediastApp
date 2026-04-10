from mongoengine import Document, StringField, ReferenceField, ListField, EmbeddedDocument, EmbeddedDocumentField, ObjectIdField, DateTimeField
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
    employees = ListField(ReferenceField(User))
    department = ReferenceField(Department, null=True)
    start_date = DateTimeField(default=datetime.datetime.utcnow)
    deadline = DateTimeField()
    tasks = ListField(EmbeddedDocumentField(ProjectTask))

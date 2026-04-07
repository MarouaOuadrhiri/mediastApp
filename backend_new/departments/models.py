from mongoengine import Document, StringField

class Department(Document):
    name = StringField(required=True, unique=True, max_length=100)
    description = StringField()

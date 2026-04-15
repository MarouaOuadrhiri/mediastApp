from mongoengine import Document, StringField

class Department(Document):
    name = StringField(required=True, unique=True, max_length=100)
    subtitle = StringField(max_length=200)
    description = StringField()
    icon = StringField()  # Will store SVG path or icon name
    image = StringField()  # Stores base64-encoded department image

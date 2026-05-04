from mongoengine import Document, StringField, ReferenceField, DateTimeField, BooleanField
import datetime
from users.models import User

class DiscussionMessage(Document):
    sender = ReferenceField(User, required=True)
    receiver = ReferenceField(User, required=True)
    text = StringField(required=True)
    timestamp = DateTimeField(default=datetime.datetime.utcnow)
    is_read = BooleanField(default=False)

    meta = {
        'collection': 'messages',  # Still pointing to the same MongoDB collection
        'indexes': ['sender', 'receiver', 'timestamp']
    }

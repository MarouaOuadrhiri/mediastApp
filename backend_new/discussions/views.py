from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from users.authentication import JWTAuthentication
from .models import DiscussionMessage
from users.models import User
from mongoengine.queryset.visitor import Q
import datetime

def serialize_message(m):
    return {
        'id': str(m.id),
        'sender': str(m.sender.id),
        'receiver': str(m.receiver.id),
        'text': m.text,
        'timestamp': m.timestamp.isoformat() + 'Z',
        'is_read': m.is_read
    }

@api_view(['GET', 'POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def discussion_list_create(request):
    if request.method == 'GET':
        with_user_id = request.query_params.get('with_user')
        current_user_id = request.user.id
        
        if with_user_id:
            query = (Q(sender=current_user_id) & Q(receiver=with_user_id)) | \
                    (Q(sender=with_user_id) & Q(receiver=current_user_id))
            messages = DiscussionMessage.objects.filter(query).order_by('timestamp')
        else:
            query = Q(sender=current_user_id) | Q(receiver=current_user_id)
            messages = DiscussionMessage.objects.filter(query).order_by('timestamp')
            
        return Response([serialize_message(m) for m in messages])

    if request.method == 'POST':
        data = request.data
        receiver_id = data.get('receiver')
        text = data.get('text')

        if not receiver_id or not text:
            return Response({'error': 'receiver and text are required'}, status=400)

        try:
            receiver = User.objects.get(id=receiver_id)
        except Exception:
            return Response({'error': 'Receiver not found'}, status=404)

        message = DiscussionMessage(
            sender=request.user,
            receiver=receiver,
            text=text,
            timestamp=datetime.datetime.utcnow()
        )
        message.save()
        return Response(serialize_message(message), status=201)

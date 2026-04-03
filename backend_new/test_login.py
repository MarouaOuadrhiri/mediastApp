import os
import django
import sys
from django.contrib.auth.hashers import check_password

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.getcwd()))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mon_projet.settings')
django.setup()

from users.models import User

def test_login(username, password):
    user = User.objects(username=username).first()
    if not user:
        print(f"User {username} not found.")
        return
    
    print(f"User found: {user.username}")
    print(f"Password in DB (hash): {user.password}")
    
    is_correct = check_password(password, user.password)
    print(f"Password correct? {is_correct}")

test_login('admin', 'admin')

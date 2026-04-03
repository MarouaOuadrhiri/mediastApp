import os
import django
import sys

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.getcwd()))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mon_projet.settings')
django.setup()

from users.models import User
try:
    admin_user = User.objects(username='admin').first()
    print(f"User count: {User.objects.count()}")
    if admin_user:
        print(f"Admin user found: {admin_user.username}, role: {admin_user.role}")
    else:
        print("Admin user NOT found.")
except Exception as e:
    print(f"Error: {e}")

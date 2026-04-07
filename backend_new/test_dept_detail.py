import os
import django
import sys
import json

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.getcwd()))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mon_projet.settings')
django.setup()

from departments.models import Department
from users.models import User
from projects.models import Project
from departments.views import department_detail
from rest_framework.test import APIRequestFactory
from rest_framework.response import Response

def test_api():
    dep = Department.objects.first()
    if not dep:
        print("No department found to test.")
        return
    
    print(f"Testing detail for department: {dep.name} ({dep.id})")
    
    factory = APIRequestFactory()
    request = factory.get(f'/api/departments/{dep.id}/')
    
    # Mock authentication
    admin = User.objects(role='ADMIN').first()
    request.user = admin
    
    response = department_detail(request, pk=str(dep.id))
    print("Response Status:", response.status_code)
    print("Response Data Structure:")
    for key in response.data:
        if isinstance(response.data[key], list):
            print(f"  - {key}: list with {len(response.data[key])} items")
        else:
            print(f"  - {key}: {type(response.data[key]).__name__}")

test_api()

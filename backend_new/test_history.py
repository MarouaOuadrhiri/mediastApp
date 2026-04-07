import os
import django
from bson import ObjectId

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mon_projet.settings')
django.setup()

from users.models import User
from projects.models import Project
from tasks.models import Task
from mongoengine.queryset.visitor import Q

def test():
    pk = '69ce52be2f1756fdd5a81008'
    uid = ObjectId(pk)
    print(f"Testing User ID: {uid}")
    
    try:
        user = User.objects.get(id=uid)
        print(f"Found User: {user.username}")
        
        # Core logic
        filters = [Q(employees=uid), Q(tasks__completed_by=uid)]
        if user.department:
            filters.append(Q(department=user.department.id))
        
        query = filters[0]
        for q in filters[1:]:
            query |= q
            
        projects = Project.objects.filter(query).order_by('-start_date')
        print(f"Projects found: {len(projects)}")
        
        for p in projects:
            print(f"Serializing Project: {p.name}")
            for t in p.tasks:
                cb = getattr(t, 'completed_by', None)
                if cb:
                   # This mimics the logic in the view
                   try:
                       cb_id = str(cb.id)
                       print(f"  Task {t.title} completed by {cb_id}")
                       name = user.username if cb_id == str(uid) else cb.username
                       print(f"  Name: {name}")
                   except Exception as task_e:
                       print(f"  FAILED on task {t.title}: {task_e}")

    except Exception as e:
        import traceback
        print(f"CRASHED: {e}")
        traceback.print_exc()

if __name__ == '__main__':
    test()

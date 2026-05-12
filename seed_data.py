import sys
import os
import django
import datetime
import random
import bson

# Add backend_new to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend_new'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mon_projet.settings')
django.setup()

from mongoengine import connect
from django.contrib.auth.hashers import make_password

from departments.models import Department
from users.models import User, AttendanceRecord, UserSession
from tasks.models import Task
from projects.models import Project, ProjectTask
from meetings.models import Meeting
from discussions.models import DiscussionMessage

# ─────────────────────────────────────────────
# 0. CLEANUP
# ─────────────────────────────────────────────
print("Cleaning up old records...")
AttendanceRecord.objects.delete()
Task.objects.delete()
Project.objects.delete()
Meeting.objects.delete()
DiscussionMessage.objects.delete()
User.objects.delete()
UserSession.objects.delete()
Department.objects.delete()
print("[OK] Cleanup finished\n")

# ─────────────────────────────────────────────
# 1. DEPARTMENTS
# ─────────────────────────────────────────────
print("Seeding departments...")
dept_data = [
    {
        "name": "Engineering", 
        "subtitle": "Software & Hardware", 
        "description": "Building the future of BrandShift through code and innovation.", 
        "icon": "code", 
        "image": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800"
    },
    {
        "name": "Marketing", 
        "subtitle": "Growth & Presence", 
        "description": "Spreading the word and growing our user base globally.", 
        "icon": "megaphone", 
        "image": "https://images.unsplash.com/photo-1533750516457-a7f992034fce?auto=format&fit=crop&w=800"
    },
    {
        "name": "Design", 
        "subtitle": "Visuals & UX", 
        "description": "Crafting beautiful and intuitive experiences for our users.", 
        "icon": "palette", 
        "image": "https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=800"
    },
    {
        "name": "Human Resources", 
        "subtitle": "People & Talent", 
        "description": "Finding and nurturing the best talent in the industry.", 
        "icon": "users", 
        "image": "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=800"
    },
    {
        "name": "Finance", 
        "subtitle": "Strategy & Numbers", 
        "description": "Managing our resources to ensure long-term stability.", 
        "icon": "chart-bar", 
        "image": "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=800"
    }
]

departments = []
for d in dept_data:
    dept = Department(**d)
    dept.save()
    departments.append(dept)

print(f"[OK] {len(departments)} departments ready")

# ─────────────────────────────────────────────
# 2. USERS (EMPLOYEES ONLY)
# ─────────────────────────────────────────────
print("Seeding employees...")
employees = []
emp_names = [
    ("Alice", "Vance"), ("Bob", "Ross"), ("Charlie", "Sheen"), 
    ("Diana", "Prince"), ("Edward", "Norton"), ("Fiona", "Apple"),
    ("George", "Clooney"), ("Hannah", "Baker"), ("Ian", "Somerhalder"),
    ("Julia", "Roberts")
]

hashed_pw = make_password("password123")

for i, (fn, ln) in enumerate(emp_names):
    dept = departments[i % len(departments)]
    user = User(
        email=f"{fn.lower()}@brandshift.com",
        password=hashed_pw,
        first_name=fn,
        last_name=ln,
        role='EMPLOYEE',
        department=dept,
        profile_photo=f"https://i.pravatar.cc/150?u={fn}",
        bio=f"Dedicated member of the {dept.name} team at BrandShift.",
        preferences={"theme": "dark", "notifications": True}
    )
    user.save()
    employees.append(user)

print(f"[OK] {len(employees)} employees ready (Password: password123)")

# ─────────────────────────────────────────────
# 3. STANDALONE TASKS
# ─────────────────────────────────────────────
print("Seeding standalone tasks...")
task_titles = [
    "Review Q3 Analytics", "Update Team Documentation", "Fix Header CSS",
    "Prepare Presentation", "Interview Candidate", "Database Migration",
    "Client Call", "Security Audit", "API Documentation", "Bug Triaging"
]

for i, title in enumerate(task_titles):
    assignee = employees[i % len(employees)]
    task = Task(
        title=title,
        description=f"Automated task for {title}. Please ensure all requirements are met.",
        status=random.choice(['BLOCKED', 'IN_PROGRESS', 'REVIEW', 'DONE']),
        deadline=datetime.datetime.utcnow() + datetime.timedelta(days=random.randint(1, 14)),
        employees=[assignee],
        department=assignee.department,
        is_archived=False
    )
    task.save()

print("[OK] Standalone tasks ready")

# ─────────────────────────────────────────────
# 4. PROJECTS & PROJECT TASKS
# ─────────────────────────────────────────────
print("Seeding projects...")
project_data = [
    {
        "name": "Chronos Glass UI",
        "client": "Internal",
        "description": "Modernizing the entire BrandShift interface with glassmorphism and high-fidelity animations.",
        "owner": "Maroua Ouadrhiri",
        "status": "In Progress",
        "priority": "URGENT",
        "is_high_priority": True,
        "budget": "$50,000",
        "duration": "3 months",
        "tags": ["UI/UX", "Frontend", "Design System"],
        "start_date": datetime.datetime.utcnow() - datetime.timedelta(days=10)
    },
    {
        "name": "Global Expansion Strategy",
        "client": "Strategy Group",
        "description": "Planning and executing the market entry for the APAC region.",
        "owner": "John Smith",
        "status": "Pending",
        "priority": "HIGH",
        "is_high_priority": True,
        "budget": "$120,000",
        "duration": "6 months",
        "tags": ["Marketing", "Strategy", "Global"],
        "start_date": datetime.datetime.utcnow()
    },
    {
        "name": "Alpha Engine Refactor",
        "client": "Engineering",
        "description": "Backend optimization and migration to a high-concurrency architecture.",
        "owner": "Alice Vance",
        "status": "In Progress",
        "priority": "MEDIUM",
        "is_high_priority": False,
        "budget": "$30,000",
        "duration": "2 months",
        "tags": ["Backend", "Performance", "Cloud"],
        "start_date": datetime.datetime.utcnow() - datetime.timedelta(days=5)
    }
]

for p_info in project_data:
    dept = departments[random.randint(0, len(departments)-1)]
    # Assign some employees to the project
    proj_employees = random.sample(employees, 4)
    
    project = Project(
        **p_info,
        department=dept,
        employees=proj_employees,
        deadline=datetime.datetime.utcnow() + datetime.timedelta(days=random.randint(30, 90))
    )
    
    # Create embedded tasks for the project
    project.tasks = []
    task_templates = [
        "Research phase", "Wireframe design", "Core development", "Unit testing", "UAT", "Final Deployment"
    ]
    
    for i, t_title in enumerate(task_templates):
        pt = ProjectTask(
            id=bson.ObjectId(),
            title=t_title,
            description=f"Project-specific task for {p_info['name']}.",
            status=random.choice(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED']),
            deadline=project.deadline - datetime.timedelta(days=random.randint(1, 15)),
            assigned_to=random.choice(proj_employees),
            is_archived=False
        )
        project.tasks.append(pt)
    
    project.save()

print("[OK] Projects and Project Tasks ready")

# ─────────────────────────────────────────────
# 5. MEETINGS
# ─────────────────────────────────────────────
print("Seeding meetings...")
meeting_titles = [
    "Sprint Planning", "Client Feedback", "Team Sync", "Design Critique", "Post-Mortem Analysis"
]

for i, m_title in enumerate(meeting_titles):
    creator = random.choice(employees)
    meeting = Meeting(
        title=m_title,
        description=f"Weekly sync regarding {m_title}.",
        date_time=datetime.datetime.utcnow() + datetime.timedelta(days=random.randint(1, 5), hours=random.randint(9, 17)),
        departments=[creator.department],
        employees=random.sample(employees, 3),
        created_by=creator,
        status='TODO'
    )
    meeting.save()

print("[OK] Meetings ready")

# ─────────────────────────────────────────────
# 6. MESSAGES
# ─────────────────────────────────────────────
print("Seeding discussion messages...")
sample_texts = [
    "Hey, did you finish the design?", "Yes, just uploaded it.", "Great work!",
    "Can you check the API docs?", "Sure, will do it in 5 mins.", "Thanks!",
    "Are we still on for the meeting?", "Yes, see you there.", "Awesome."
]

for _ in range(20):
    s, r = random.sample(employees, 2)
    msg = DiscussionMessage(
        sender=s,
        receiver=r,
        text=random.choice(sample_texts),
        timestamp=datetime.datetime.utcnow() - datetime.timedelta(minutes=random.randint(1, 1000)),
        is_read=random.choice([True, False])
    )
    msg.save()

print("[OK] Messages ready")
print("\n[FINISH] Seeding complete. No admin user created.")
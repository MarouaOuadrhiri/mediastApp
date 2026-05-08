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
from users.models import User, AttendanceRecord
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

# Add some extra departments for volume
for i in range(10):
    d = Department(
        name=f"Operations Unit {i+1}",
        subtitle=f"Unit {i+1} Management",
        description=f"Specialized operations for unit {i+1}.",
        icon=random.choice(["layers", "cpu", "database", "shield"]),
        image="https://images.unsplash.com/photo-1454165833767-027ffeb99cbe?auto=format&fit=crop&w=800"
    )
    d.save()
    departments.append(d)

print(f"[OK] {len(departments)} departments ready")

# ─────────────────────────────────────────────
# 2. USERS
# ─────────────────────────────────────────────
print("Seeding users...")
FAKE_PASSWORD = make_password("password123")

user_configs = [
    {"email": "admin@company.com", "role": "ADMIN", "first_name": "Hamza", "last_name": "Admin"},
    {"email": "alice@company.com", "role": "EMPLOYEE", "first_name": "Alice", "last_name": "Engineer", "dept_idx": 0},
    {"email": "bob@company.com", "role": "EMPLOYEE", "first_name": "Bob", "last_name": "Developer", "dept_idx": 0},
    {"email": "carol@company.com", "role": "EMPLOYEE", "first_name": "Carol", "last_name": "Marketer", "dept_idx": 1},
    {"email": "dave@company.com", "role": "EMPLOYEE", "first_name": "Dave", "last_name": "Strategist", "dept_idx": 1},
    {"email": "irene@company.com", "role": "EMPLOYEE", "first_name": "Irene", "last_name": "Designer", "dept_idx": 2},
    {"email": "james@company.com", "role": "EMPLOYEE", "first_name": "James", "last_name": "Creative", "dept_idx": 2},
    {"email": "eve@company.com", "role": "EMPLOYEE", "first_name": "Eve", "last_name": "Recruiter", "dept_idx": 3},
    {"email": "grace@company.com", "role": "EMPLOYEE", "first_name": "Grace", "last_name": "Analyst", "dept_idx": 4},
]

users = []
for uc in user_configs:
    u = User(
        email=uc["email"],
        password=FAKE_PASSWORD,
        first_name=uc["first_name"],
        last_name=uc["last_name"],
        role=uc["role"],
        department=departments[uc["dept_idx"]] if "dept_idx" in uc else None,
        profile_photo=f"https://i.pravatar.cc/150?u={uc['email']}",
        bio=f"Hello, I am {uc['first_name']}, working as {uc['role']} at BrandShift."
    )
    u.save()
    users.append(u)

# Add 40 more employees
for i in range(40):
    email = f"employee{i+10}@company.com"
    u = User(
        email=email,
        password=FAKE_PASSWORD,
        first_name=f"User_{i+10}",
        last_name=f"Lastname_{i+10}",
        role="EMPLOYEE",
        department=random.choice(departments),
        profile_photo=f"https://i.pravatar.cc/150?u={email}",
        bio="Regular employee at BrandShift."
    )
    u.save()
    users.append(u)

print(f"[OK] {len(users)} users ready")

# ─────────────────────────────────────────────
# 3. PROJECTS
# ─────────────────────────────────────────────
print("Seeding projects...")
now = datetime.datetime.utcnow()
def future(days): return now + datetime.timedelta(days=days)
def past(days): return now - datetime.timedelta(days=days)

projects_data = [
    {
        "name": "BrandShift Mobile App",
        "client": "Internal",
        "description": "Revolutionizing project management on the go.",
        "status": "In Progress",
        "priority": "HIGH",
        "budget": "$150,000",
        "duration": "8 months",
        "dept_idx": 0,
        "is_high_priority": True
    },
    {
        "name": "Design System 2026",
        "client": "BrandShift",
        "description": "A unified UI library for all platforms.",
        "status": "In Progress",
        "priority": "MEDIUM",
        "budget": "$40,000",
        "duration": "4 months",
        "dept_idx": 2,
        "is_high_priority": False
    },
    {
        "name": "Q3 Revenue Campaign",
        "client": "Marketing Team",
        "description": "Boosting Q3 revenue through targeted outreach.",
        "status": "Pending",
        "priority": "URGENT",
        "budget": "$25,000",
        "duration": "2 months",
        "dept_idx": 1,
        "is_high_priority": True
    }
]

projects = []
for pd in projects_data:
    p_users = random.sample(users[1:], random.randint(3, 6))
    
    # Create embedded tasks for project
    tasks = []
    for i in range(5):
        status = random.choice(['TODO', 'IN_PROGRESS', 'DONE'])
        # Add some refusal data for testing
        is_refused = (i == 4 and pd['name'] == "BrandShift Mobile App")
        
        t = ProjectTask(
            id=bson.ObjectId(),
            title=f"{pd['name']} Task {i+1}",
            description=f"Detailed description for task {i+1} of {pd['name']}.",
            status='BLOCKED' if is_refused else status,
            deadline=future(random.randint(10, 50)),
            refusal_pending=is_refused,
            refused_by=p_users[0] if is_refused else None,
            rejection_reason="I have too many tasks right now, cannot take this one." if is_refused else ""
        )
        tasks.append(t)
        
    proj = Project(
        name=pd["name"],
        client=pd["client"],
        description=pd["description"],
        status=pd["status"],
        priority=pd["priority"],
        is_high_priority=pd["is_high_priority"],
        budget=pd["budget"],
        duration=pd["duration"],
        employees=p_users,
        department=departments[pd["dept_idx"]],
        deadline=future(random.randint(60, 120)),
        tasks=tasks
    )
    proj.save()
    projects.append(proj)

print(f"[OK] {len(projects)} projects ready")

# ─────────────────────────────────────────────
# 4. STANDALONE TASKS
# ─────────────────────────────────────────────
print("Seeding standalone tasks...")
task_titles = [
    "Fix CSS alignment in header",
    "Update API documentation for meetings",
    "Prepare monthly financial report",
    "Conduct user interview with Alice",
    "Refactor authentication interceptor",
    "Design new icons for departments",
    "Deploy staging environment for v2.1",
    "Fix bug in task refusal flow",
    "Update employee profiles",
    "Schedule all-hands meeting"
]

tasks = []
for i, title in enumerate(task_titles):
    # Add a refused task for testing
    is_refused = (i == 7)
    
    t = Task(
        title=title,
        description=f"Automated description for: {title}.",
        status='BLOCKED' if is_refused else random.choice(['IN_PROGRESS', 'REVIEW', 'DONE']),
        deadline=future(random.randint(2, 20)),
        employees=random.sample(users[1:], random.randint(1, 2)),
        department=random.choice(departments),
        project=random.choice(projects),
        refusal_pending=is_refused,
        refused_by=users[1] if is_refused else None,
        rejection_reason="I don't have the necessary permissions to fix this bug." if is_refused else ""
    )
    t.save()
    tasks.append(t)

# Add 50 more tasks for volume
for i in range(50):
    t = Task(
        title=f"General Task {i+11}",
        description="Ongoing maintenance task.",
        status=random.choice(['IN_PROGRESS', 'REVIEW', 'DONE']),
        deadline=future(random.randint(5, 40)),
        employees=random.sample(users[1:], random.randint(1, 2)),
        department=random.choice(departments),
        project=random.choice(projects)
    )
    t.save()
    tasks.append(t)

print(f"[OK] {len(tasks)} tasks ready")

# ─────────────────────────────────────────────
# 5. MEETINGS
# ─────────────────────────────────────────────
print("Seeding meetings...")
meeting_titles = [
    "Weekly Sync", "Sprint Planning", "Marketing Brainstorm", 
    "HR Policy Update", "Financial Audit", "Design Review", "All-Hands"
]

for title in meeting_titles:
    m = Meeting(
        title=title,
        description=f"Discussing matters related to {title}.",
        date_time=future(random.randint(1, 7)),
        departments=random.sample(departments, random.randint(1, 3)),
        employees=random.sample(users[1:], random.randint(5, 10)),
        created_by=users[0]
    )
    m.save()

print("[OK] Meetings ready")

# ─────────────────────────────────────────────
# 6. DISCUSSIONS
# ─────────────────────────────────────────────
print("Seeding messages...")
chat_samples = [
    "Hey, have you finished the task?",
    "Not yet, still working on the CSS.",
    "No problem, take your time.",
    "Can we meet at 2 PM?",
    "Yes, see you there!",
    "The new design looks amazing!",
    "Thanks! I worked hard on the colors."
]

for _ in range(50):
    u1, u2 = random.sample(users, 2)
    msg = DiscussionMessage(
        sender=u1,
        receiver=u2,
        text=random.choice(chat_samples),
        timestamp=past(random.randint(0, 10))
    )
    msg.save()

print("[OK] Discussions ready")

# ─────────────────────────────────────────────
# 7. ATTENDANCE
# ─────────────────────────────────────────────
print("Seeding attendance...")
for user in users[1:]:
    # Last 10 days of attendance
    for day in range(10):
        start = past(day).replace(hour=random.randint(8, 10), minute=random.randint(0, 59))
        end = start + datetime.timedelta(hours=random.randint(7, 9))
        
        AttendanceRecord(
            user=user,
            start_time=start,
            end_time=end,
            status='COMPLETED'
        ).save()

print("[OK] Attendance ready")
print("\n[OK] Database seeded successfully!")
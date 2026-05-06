import sys
import os
import django

# Add backend_new to path so mon_projet can be imported
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend_new'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mon_projet.settings')
django.setup()

from mongoengine import connect
import datetime
import random

# ── If you use mongoengine directly, connect here ──
# connect('your_db_name')

from departments.models import Department
from users.models import User, AttendanceRecord
from tasks.models import Task
from projects.models import Project, ProjectTask
from meetings.models import Meeting
from discussions.models import DiscussionMessage
import bson

# ─────────────────────────────────────────────
# 0. CLEANUP (Ensure fresh data)
# ─────────────────────────────────────────────
print("Cleaning up old records...")
AttendanceRecord.objects.delete()
Task.objects.delete()
Project.objects.delete()
Meeting.objects.delete()
DiscussionMessage.objects.delete()
print("[OK] Cleanup finished\n")

# ─────────────────────────────────────────────
# 1. DEPARTMENTS
# ─────────────────────────────────────────────
dept_data = [
    {"name": "Engineering",    "subtitle": "Build & Innovate",       "description": "Responsible for all software development and infrastructure.", "icon": "code",        "image": "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800"},
    {"name": "Marketing",      "subtitle": "Grow & Engage",          "description": "Handles brand, campaigns, and customer outreach.",               "icon": "megaphone",   "image": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800"},
    {"name": "Human Resources","subtitle": "People & Culture",       "description": "Manages hiring, onboarding, and employee wellbeing.",            "icon": "users",       "image": "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=800"},
    {"name": "Finance",        "subtitle": "Numbers & Strategy",     "description": "Oversees budgeting, payroll, and financial reporting.",          "icon": "chart-bar",   "image": "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=800"},
    {"name": "Design",         "subtitle": "Create & Inspire",       "description": "Crafts UI/UX and visual assets across all products.",            "icon": "palette",     "image": "https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=800"},
]

# Add 200 more departments
for i in range(200):
    dept_data.append({
        "name": f"Department {i+6}",
        "subtitle": f"Strategic Unit {i+6}",
        "description": f"Handling specialized operations for unit {i+6}.",
        "icon": random.choice(["layers", "trello", "cpu", "database", "shield", "truck", "anchor", "briefcase"]),
        "image": ""
    })

departments = []
for d in dept_data:
    dept = Department.objects(name=d["name"]).first()
    if not dept:
        dept = Department(**d)
        dept.save()
    else:
        for key, value in d.items():
            setattr(dept, key, value)
        dept.save()
    departments.append(dept)

print(f"[OK] {len(departments)} departments ready")

# ─────────────────────────────────────────────
# 2. USERS
# ─────────────────────────────────────────────
user_data = [
    {"email": "admin@company.com",    "role": "ADMIN",    "department": None, "first_name": "Admin", "last_name": "Root"},
    {"email": "alice@company.com",    "role": "EMPLOYEE", "department": departments[0], "first_name": "Alice", "last_name": "Engine"},
    {"email": "bob@company.com",      "role": "EMPLOYEE", "department": departments[0], "first_name": "Bob", "last_name": "Build"},
    {"email": "carol@company.com",    "role": "EMPLOYEE", "department": departments[1], "first_name": "Carol", "last_name": "Market"},
    {"email": "dave@company.com",     "role": "EMPLOYEE", "department": departments[1], "first_name": "Dave", "last_name": "Growth"},
    {"email": "eve@company.com",      "role": "EMPLOYEE", "department": departments[2], "first_name": "Eve", "last_name": "People"},
    {"email": "frank@company.com",    "role": "EMPLOYEE", "department": departments[2], "first_name": "Frank", "last_name": "Culture"},
    {"email": "grace@company.com",    "role": "EMPLOYEE", "department": departments[3], "first_name": "Grace", "last_name": "Strategy"},
    {"email": "henry@company.com",    "role": "EMPLOYEE", "department": departments[3], "first_name": "Henry", "last_name": "Budget"},
    {"email": "irene@company.com",    "role": "EMPLOYEE", "department": departments[4], "first_name": "Irene", "last_name": "Creative"},
    {"email": "james@company.com",    "role": "EMPLOYEE", "department": departments[4], "first_name": "James", "last_name": "Vision"},
    {"email": "karen@company.com",    "role": "ADMIN",    "department": departments[0], "first_name": "Karen", "last_name": "Manager"},
]

# Add 200 more users
for i in range(200):
    user_data.append({
        "email": f"employee{i+13}@company.com",
        "role": "EMPLOYEE",
        "department": random.choice(departments),
        "first_name": f"User_{i+13}",
        "last_name": f"Last_{i+13}"
    })

from django.contrib.auth.hashers import make_password
FAKE_PASSWORD = make_password("password123")

users = []
for u in user_data:
    user = User.objects(email=u["email"]).first()
    if not user:
        user = User(
            email=u["email"],
            first_name=u.get("first_name", ""),
            last_name=u.get("last_name", ""),
            password=FAKE_PASSWORD,
            role=u["role"],
            department=u["department"],
            profile_photo=f"https://i.pravatar.cc/150?u={u['email']}",
        )
        user.save()
    else:
        # Update existing to have names and photo
        user.first_name = u.get("first_name", "")
        user.last_name = u.get("last_name", "")
        user.profile_photo = f"https://i.pravatar.cc/150?u={u['email']}"
        user.save()
    users.append(user)

print(f"[OK] {len(users)} users ready")

# ─────────────────────────────────────────────
# 3. ATTENDANCE RECORDS  (realistic hour distribution for the heatmap)
# ─────────────────────────────────────────────
now = datetime.datetime.utcnow()

# Weighted hour probabilities – heavier during typical work hours
# Index = hour (0-23), value = relative weight
HOUR_WEIGHTS = [
    1,  1,  0,  0,  0,  1,  2,  5,   # 00-07  (night / early)
   15, 20, 12, 10,  8,  14, 16, 10,  # 08-15  (core work)
    8,  6,  4,  3,  2,  2,  1,  1,   # 16-23  (evening)
]
HOUR_POOL = []
for h, w in enumerate(HOUR_WEIGHTS):
    HOUR_POOL.extend([h] * w)

attendance_records = []
employee_pool = users[1:]  # skip admin

for day_offset in range(30):  # 30 days of history
    # Pick a random subset of employees who "logged in" that day
    daily_count = random.randint(len(employee_pool) // 3, len(employee_pool))
    daily_users = random.sample(employee_pool, daily_count)

    for user in daily_users:
        login_hour = random.choice(HOUR_POOL)
        login_minute = random.randint(0, 59)
        start = (now - datetime.timedelta(days=day_offset)).replace(
            hour=login_hour, minute=login_minute, second=0, microsecond=0
        )
        session_len = random.randint(3, 9)  # 3-9 hour sessions
        end = start + datetime.timedelta(hours=session_len, minutes=random.randint(0, 59))
        status = "COMPLETED" if day_offset > 0 else random.choice(["ACTIVE", "COMPLETED"])

        rec = AttendanceRecord(
            user=user,
            start_time=start,
            end_time=end if status == "COMPLETED" else None,
            status=status,
        )
        rec.save()
        attendance_records.append(rec)

print(f"[OK] {len(attendance_records)} attendance records created")

# ─────────────────────────────────────────────
# 4. PROJECTS  (must come before Tasks)
# ─────────────────────────────────────────────
def future(days): return now + datetime.timedelta(days=days)

project_tasks_pool = [
    ("Design wireframes",       "Low-fidelity screens for all main flows",    "IN_PROGRESS"),
    ("Set up CI/CD pipeline",   "GitHub Actions with Docker deployment",       "DONE"),
    ("Write API documentation", "OpenAPI 3.0 spec for all endpoints",         "TODO"),
    ("User acceptance testing", "UAT with 5 pilot customers",                  "TODO"),
    ("Database optimisation",   "Add indexes, query profiling",                "IN_PROGRESS"),
    ("Brand refresh assets",    "New logo, color palette, typography guide",   "DONE"),
]

projects_data = [
    {
        "name": "ERP System Overhaul",
        "client": "Internal",
        "description": "Full rewrite of the legacy ERP platform using Django + React.",
        "owner": "karen_eng",
        "status": "In Progress",
        "priority": "HIGH",
        "is_high_priority": True,
        "budget": "$120,000",
        "duration": "6 months",
        "tags": ["backend", "frontend", "migration"],
        "employees": users[1:4],
        "department": departments[0],
        "start_date": now - datetime.timedelta(days=30),
        "deadline": future(150),
        "task_indices": [0, 1, 2],
    },
    {
        "name": "Q3 Marketing Campaign",
        "client": "External – Brand Team",
        "description": "Multi-channel campaign for the product launch in Q3.",
        "owner": "carol_mkt",
        "status": "Pending",
        "priority": "MEDIUM",
        "is_high_priority": False,
        "budget": "$45,000",
        "duration": "3 months",
        "tags": ["campaign", "social", "email"],
        "employees": users[3:6],
        "department": departments[1],
        "start_date": now - datetime.timedelta(days=10),
        "deadline": future(80),
        "task_indices": [3, 5],
    },
    {
        "name": "HR Self-Service Portal",
        "client": "Internal – HR",
        "description": "Employee portal for leave requests, payslips, and onboarding docs.",
        "owner": "eve_hr",
        "status": "Pending",
        "priority": "LOW",
        "is_high_priority": False,
        "budget": "$30,000",
        "duration": "4 months",
        "tags": ["portal", "hr", "self-service"],
        "employees": [users[5], users[6], users[1]],
        "department": departments[2],
        "start_date": future(15),
        "deadline": future(130),
        "task_indices": [2, 4],
    },
    {
        "name": "Annual Finance Audit Prep",
        "client": "Internal – Finance",
        "description": "Prepare all documents and dashboards required for the annual external audit.",
        "owner": "grace_fin",
        "status": "In Progress",
        "priority": "URGENT",
        "is_high_priority": True,
        "budget": "$15,000",
        "duration": "6 weeks",
        "tags": ["audit", "compliance", "reporting"],
        "employees": [users[7], users[8]],
        "department": departments[3],
        "start_date": now - datetime.timedelta(days=7),
        "deadline": future(35),
        "task_indices": [3, 4],
    },
    {
        "name": "Design System v2",
        "client": "Internal – Product",
        "description": "Build a comprehensive component library and Figma token system.",
        "owner": "irene_design",
        "status": "In Progress",
        "priority": "HIGH",
        "is_high_priority": False,
        "budget": "$20,000",
        "duration": "2 months",
        "tags": ["design-system", "figma", "components"],
        "employees": [users[9], users[10], users[1]],
        "department": departments[4],
        "start_date": now - datetime.timedelta(days=14),
        "deadline": future(46),
        "task_indices": [0, 5],
    },
]

projects = []
for pd in projects_data:
    embedded_tasks = []
    for ti in pd.pop("task_indices"):
        t = project_tasks_pool[ti]
        pt = ProjectTask(
            id=bson.ObjectId(),
            title=t[0],
            description=t[1],
            status=t[2],
            deadline=future(random.randint(10, 60)),
            completed_by=random.choice(pd["employees"]) if t[2] == "DONE" else None,
            completed_at=now - datetime.timedelta(days=random.randint(1, 5)) if t[2] == "DONE" else None,
        )
        embedded_tasks.append(pt)

    proj = Project(
        name=pd["name"],
        client=pd["client"],
        description=pd["description"],
        owner=pd["owner"],
        status=pd["status"],
        priority=pd["priority"],
        is_high_priority=pd["is_high_priority"],
        budget=pd["budget"],
        duration=pd["duration"],
        tags=pd["tags"],
        employees=pd["employees"],
        department=pd["department"],
        start_date=pd["start_date"],
        deadline=pd["deadline"],
        tasks=embedded_tasks,
    )
    proj.save()
    projects.append(proj)

# Add 200 more projects with progressive completion for a nice chart curve
more_task_pool = [
    ("Requirements gathering",    "Document stakeholder needs",          "DONE"),
    ("Architecture design",       "System design and tech stack choice", "DONE"),
    ("Sprint planning",           "Break work into 2-week sprints",      "DONE"),
    ("Core implementation",       "Build the main features",             "IN_PROGRESS"),
    ("Integration testing",       "End-to-end test suites",              "IN_PROGRESS"),
    ("Code review cycle",         "Peer review all pull requests",       "TODO"),
    ("Security audit",            "Penetration testing and fixes",       "TODO"),
    ("Performance tuning",        "Load testing and optimization",       "TODO"),
    ("Documentation",             "Write user and API docs",             "IN_PROGRESS"),
    ("Deployment preparation",    "Staging environment setup",           "DONE"),
]

for i in range(200):
    # Gradually shift task statuses: older projects → more DONE
    progress_ratio = i / 200  # 0.0 (oldest) → 1.0 (newest)
    num_tasks = random.randint(3, 6)
    chosen_tasks = random.sample(more_task_pool, min(num_tasks, len(more_task_pool)))

    embedded = []
    proj_employees = random.sample(users[1:], random.randint(2, 5))
    for title, desc, _default_status in chosen_tasks:
        # Older projects (low i) get more DONE, newer ones more TODO
        r = random.random()
        if progress_ratio < 0.3:
            status = "DONE" if r < 0.75 else "IN_PROGRESS"
        elif progress_ratio < 0.6:
            status = "DONE" if r < 0.5 else ("IN_PROGRESS" if r < 0.85 else "TODO")
        else:
            status = "DONE" if r < 0.2 else ("IN_PROGRESS" if r < 0.6 else "TODO")

        embedded.append(ProjectTask(
            id=bson.ObjectId(),
            title=title,
            description=desc,
            status=status,
            deadline=future(random.randint(10, 90)),
            completed_by=random.choice(proj_employees) if status == "DONE" else None,
            completed_at=now - datetime.timedelta(days=random.randint(1, 20)) if status == "DONE" else None,
        ))

    proj = Project(
        name=f"Expansion Project {i+6}",
        client=random.choice(["Global Solutions", "Tech Innovators", "Nexa Corp", "Internal"]),
        description=f"Automated scaling project for sector {i+6}.",
        owner=random.choice(["karen_eng", "carol_mkt", "eve_hr", "grace_fin", "irene_design"]),
        status=random.choice(["In Progress", "Pending", "On Hold"]),
        priority=random.choice(["LOW", "MEDIUM", "HIGH", "URGENT"]),
        is_high_priority=random.choice([True, False]),
        budget=f"${random.randint(20, 500)},000",
        duration=f"{random.randint(2, 18)} months",
        tags=random.sample(["cloud", "ai", "security", "infrastructure", "mobile", "analytics"], 3),
        employees=proj_employees,
        department=random.choice(departments),
        start_date=now - datetime.timedelta(days=random.randint(0, 60)),
        deadline=future(random.randint(60, 300)),
        tasks=embedded,
    )
    proj.save()
    projects.append(proj)

print(f"[OK] {len(projects)} projects created")

# ─────────────────────────────────────────────
# 5. TASKS  (standalone board tasks)
# ─────────────────────────────────────────────
task_data = [
    {"title": "Fix login redirect bug",           "description": "Users are redirected to 404 after OAuth login.",         "status": "DONE",        "employees": [users[1]],          "department": departments[0]},
    {"title": "Write unit tests for auth module", "description": "Cover all edge cases for JWT token validation.",          "status": "DONE",        "employees": [users[2]],          "department": departments[0]},
    {"title": "Create Q3 email templates",        "description": "Design 3 email variants for the launch campaign.",       "status": "DONE",        "employees": [users[3], users[9]], "department": departments[1]},
    {"title": "Update employee handbook",         "description": "Incorporate new remote work and PTO policies.",          "status": "DONE",        "employees": [users[5]],          "department": departments[2]},
    {"title": "Monthly payroll reconciliation",   "description": "Cross-check payroll figures with bank statements.",      "status": "DONE",        "employees": [users[7]],          "department": departments[3]},
    {"title": "Prepare audit evidence binder",    "description": "Compile receipts, contracts, and GL exports.",           "status": "DONE",        "employees": [users[8]],          "department": departments[3]},
    {"title": "Redesign dashboard cards",         "description": "Apply new design tokens to all KPI card components.",   "status": "DONE",        "employees": [users[9], users[10]],"department": departments[4]},
    {"title": "Conduct user interviews",          "description": "5 x 45-min sessions with power users for roadmap input.","status": "DONE",       "employees": [users[3], users[5]], "department": departments[1]},
    {"title": "Set up staging environment",       "description": "Mirror production on a separate VPS for QA.",            "status": "DONE",        "employees": [users[1], users[2]], "department": departments[0]},
    {"title": "Icon library audit",               "description": "Remove duplicates and document usage guidelines.",       "status": "DONE",        "employees": [users[10]],         "department": departments[4]},
]

# Add 200 more tasks with weighted status for a meaningful completion rate (~84% target)
TASK_STATUSES = ["DONE"] * 84 + ["IN_PROGRESS"] * 10 + ["REVIEW"] * 4 + ["BLOCKED"] * 2
for i in range(200):
    task_data.append({
        "title": f"Automated Task {i+11}",
        "description": f"Standard operational task for sequence {i+11}.",
        "status": random.choice(TASK_STATUSES),
        "employees": random.sample(users, random.randint(1, 2)),
        "department": random.choice(departments)
    })

tasks = []
for td in task_data:
    project = random.choice(projects)
    source_project_task_id = None
    task_deadline = None
    
    if project.tasks:
        pt = random.choice(project.tasks)
        source_project_task_id = str(pt.id)
        task_deadline = pt.deadline
        # Give some tasks very near deadlines for the URGENT demo
        if random.random() > 0.7:
            task_deadline = now + datetime.timedelta(days=random.randint(0, 2))
            pt.deadline = task_deadline
            project.save()

    if not task_deadline:
        task_deadline = now + datetime.timedelta(days=random.randint(5, 30))

    task = Task(
        title=td["title"],
        description=td["description"],
        status=td["status"],
        employees=td["employees"],
        department=td["department"],
        project=project,
        source_project_task_id=source_project_task_id,
        deadline=task_deadline,
        is_archived=(td["status"] == "ARCHIVED"),
    )
    task.save()
    tasks.append(task)

print(f"[OK] {len(tasks)} tasks created")

# ─────────────────────────────────────────────
# 6. MEETINGS
# ─────────────────────────────────────────────
meeting_data = [
    {
        "title": "Weekly Engineering Stand-up",
        "description": "Quick sync on blockers, progress, and priorities for the week.",
        "date_time": now + datetime.timedelta(days=1, hours=9),
        "departments": [departments[0]],
        "employees": users[1:4],
        "created_by": users[11],  # karen_eng (admin)
    },
    {
        "title": "Q3 Campaign Kick-off",
        "description": "Align on goals, timeline, and ownership for the Q3 marketing push.",
        "date_time": now + datetime.timedelta(days=2, hours=10),
        "departments": [departments[1], departments[4]],
        "employees": [users[3], users[4], users[9]],
        "created_by": users[0],
    },
    {
        "title": "All-Hands: Product Roadmap",
        "description": "Company-wide update on H2 strategy and OKRs.",
        "date_time": now + datetime.timedelta(days=5, hours=14),
        "departments": departments,  # all departments
        "employees": users,
        "created_by": users[0],
    },
    {
        "title": "Design Review – Design System v2",
        "description": "Walkthrough of new component specs and Figma token structure.",
        "date_time": now + datetime.timedelta(days=3, hours=11),
        "departments": [departments[4], departments[0]],
        "employees": [users[9], users[10], users[1]],
        "created_by": users[9],
    },
    {
        "title": "Finance Audit Pre-check",
        "description": "Internal dry-run before the external auditors arrive.",
        "date_time": now + datetime.timedelta(days=7, hours=9),
        "departments": [departments[3]],
        "employees": [users[7], users[8]],
        "created_by": users[11],
    },
    {
        "title": "HR Onboarding Process Review",
        "description": "Improve the 30-day onboarding checklist based on new-hire feedback.",
        "date_time": now - datetime.timedelta(days=3, hours=2),  # past meeting
        "departments": [departments[2]],
        "employees": [users[5], users[6]],
        "created_by": users[5],
    },
]

# Add 200 more meetings
for i in range(200):
    meeting_data.append({
        "title": f"Sync Meeting #{i+7}",
        "description": f"Coordination and alignment for squad {i+7}.",
        "date_time": now + datetime.timedelta(days=random.randint(-5, 15), hours=random.randint(9, 17)),
        "departments": random.sample(departments, random.randint(1, 2)),
        "employees": random.sample(users, random.randint(3, 8)),
        "created_by": random.choice(users),
    })

meetings = []
for md in meeting_data:
    meeting = Meeting(
        title=md["title"],
        description=md["description"],
        date_time=md["date_time"],
        departments=md["departments"],
        employees=md["employees"],
        created_by=md["created_by"],
    )
    meeting.save()
    meetings.append(meeting)

print(f"[OK] {len(meetings)} meetings created")

print(f"   Tasks       : {len(tasks)}")
print(f"   Meetings    : {len(meetings)}")

# ─────────────────────────────────────────────
# 7. CONVERSATIONS
# ─────────────────────────────────────────────
print("\nSeeding initial conversations...")
messages_count = 0
for i in range(len(users) // 2):
    u1 = users[i*2]
    u2 = users[i*2 + 1]
    
    chat_lines = [
        "Hello! How is the project going?",
        "It's going well, we are ahead of schedule.",
        "Great to hear! Let me know if you need any help.",
        "Will do. Talk to you later!",
        "Salam, chno khdemti?",
        "Walo, baki kantsena l'audit.",
        "Ok, tsebber chwia."
    ]
    
    for line in random.sample(chat_lines, 3):
        msg = DiscussionMessage(
            sender=u1,
            receiver=u2,
            text=line,
            timestamp=now - datetime.timedelta(minutes=random.randint(5, 500))
        )
        msg.save()
        messages_count += 1

print(f"[OK] {messages_count} messages seeded")
print("\n[OK] Everything is ready!")
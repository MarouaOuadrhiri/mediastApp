# seed_data.py
import datetime
import random
from mongoengine import connect

connect('mediast_db')  # replace with your DB name

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend_new'))
from departments.models import Department
from users.models import User, AttendanceRecord
from projects.models import Project, ProjectTask
from tasks.models import Task
from meetings.models import Meeting
import bcrypt
import bson

# ─────────────────────────────────────────
# 1. DEPARTMENTS
# ─────────────────────────────────────────

departments_data = [
    {"name": "Video Production",     "description": "Handles all video content, reels, and motion graphics."},
    {"name": "Graphic Design",       "description": "Brand identity, visual assets, and UI mockups."},
    {"name": "Social Media",         "description": "Content planning, posting, and community management."},
    {"name": "Copywriting",          "description": "Scripts, captions, blog posts, and ad copy."},
    {"name": "Marketing Strategy",   "description": "Campaign planning, analytics, and growth hacking."},
    {"name": "Web Development",      "description": "Landing pages, dashboards, and client portals."},
    {"name": "Photography",          "description": "Product shoots, portraits, and event coverage."},
    {"name": "Motion Design",        "description": "2D/3D animation, intros, and transitions."},
]

departments = []
for d in departments_data:
    dept = Department(name=d["name"], description=d["description"])
    dept.save()
    departments.append(dept)

print(f"✅ {len(departments)} departments created")

# ─────────────────────────────────────────
# 2. USERS
# ─────────────────────────────────────────

hashed_pw = bcrypt.hashpw(b"Password123!", bcrypt.gensalt()).decode()

users_data = [
    # Admins
    {"username": "adam.reeves",    "email": "adam.reeves@agency.com",    "role": "ADMIN",    "dept": 4},
    {"username": "sofia.blanc",    "email": "sofia.blanc@agency.com",    "role": "ADMIN",    "dept": 0},

    # Video Production
    {"username": "marcus.thorne",  "email": "marcus.thorne@agency.com",  "role": "EMPLOYEE", "dept": 0},
    {"username": "layla.santos",   "email": "layla.santos@agency.com",   "role": "EMPLOYEE", "dept": 0},
    {"username": "james.okafor",   "email": "james.okafor@agency.com",   "role": "EMPLOYEE", "dept": 0},

    # Graphic Design
    {"username": "nina.vasquez",   "email": "nina.vasquez@agency.com",   "role": "EMPLOYEE", "dept": 1},
    {"username": "tom.eriksen",    "email": "tom.eriksen@agency.com",    "role": "EMPLOYEE", "dept": 1},
    {"username": "priya.mehta",    "email": "priya.mehta@agency.com",    "role": "EMPLOYEE", "dept": 1},

    # Social Media
    {"username": "zara.clinton",   "email": "zara.clinton@agency.com",   "role": "EMPLOYEE", "dept": 2},
    {"username": "leo.dumont",     "email": "leo.dumont@agency.com",     "role": "EMPLOYEE", "dept": 2},
    {"username": "amira.hassan",   "email": "amira.hassan@agency.com",   "role": "EMPLOYEE", "dept": 2},

    # Copywriting
    {"username": "felix.warren",   "email": "felix.warren@agency.com",   "role": "EMPLOYEE", "dept": 3},
    {"username": "diana.cross",    "email": "diana.cross@agency.com",    "role": "EMPLOYEE", "dept": 3},

    # Marketing Strategy
    {"username": "carlos.vega",    "email": "carlos.vega@agency.com",    "role": "EMPLOYEE", "dept": 4},
    {"username": "hana.kowalski",  "email": "hana.kowalski@agency.com",  "role": "EMPLOYEE", "dept": 4},

    # Web Development
    {"username": "ryan.cho",       "email": "ryan.cho@agency.com",       "role": "EMPLOYEE", "dept": 5},
    {"username": "elena.petrov",   "email": "elena.petrov@agency.com",   "role": "EMPLOYEE", "dept": 5},
    {"username": "omar.idrissi",   "email": "omar.idrissi@agency.com",   "role": "EMPLOYEE", "dept": 5},

    # Photography
    {"username": "isla.morgan",    "email": "isla.morgan@agency.com",    "role": "EMPLOYEE", "dept": 6},
    {"username": "yusuf.ali",      "email": "yusuf.ali@agency.com",      "role": "EMPLOYEE", "dept": 6},

    # Motion Design
    {"username": "chloe.martin",   "email": "chloe.martin@agency.com",   "role": "EMPLOYEE", "dept": 7},
    {"username": "dev.patel",      "email": "dev.patel@agency.com",      "role": "EMPLOYEE", "dept": 7},
]

users = []
for u in users_data:
    user = User(
        username=u["username"],
        email=u["email"],
        password=hashed_pw,
        role=u["role"],
        department=departments[u["dept"]],
        profile_photo=f"https://api.dicebear.com/7.x/avataaars/svg?seed={u['username']}"
    )
    user.save()
    users.append(user)

print(f"✅ {len(users)} users created")

# ─────────────────────────────────────────
# 3. ATTENDANCE RECORDS
# ─────────────────────────────────────────

now = datetime.datetime.utcnow()

for user in users:
    for days_ago in range(0, 30):
        start = now - datetime.timedelta(days=days_ago, hours=random.randint(0, 2))
        start = start.replace(hour=random.randint(8, 10), minute=random.randint(0, 59), second=0)
        is_active = (days_ago == 0 and random.random() > 0.4)
        end = None if is_active else start + datetime.timedelta(hours=random.randint(5, 10))
        record = AttendanceRecord(
            user=user,
            start_time=start,
            end_time=end,
            status='ACTIVE' if is_active else 'COMPLETED'
        )
        record.save()

print("✅ Attendance records created")

# ─────────────────────────────────────────
# 4. PROJECTS
# ─────────────────────────────────────────

projects_raw = [
    {
        "name": "Luxury Perfume Reels",
        "description": "Series of 15 high-end reels for a perfume brand launch. Cinematic color grading required.",
        "dept": 0,
        "employees": [2, 3, 4],
        "start_offset": -20,
        "deadline_offset": 10,
        "tasks": [
            {"title": "Write reel scripts",           "desc": "3 scripts x 30s for each perfume variant",                    "status": "DONE"},
            {"title": "Shoot raw footage",            "desc": "Studio shoot with model — 3 outfits, 2 locations",            "status": "DONE"},
            {"title": "Color grading — Oud Noir",     "desc": "Apply cinematic LUT, match reference board",                  "status": "DONE"},
            {"title": "Color grading — Rose Elixir",  "desc": "Warm tones, soft bloom effect",                               "status": "IN_PROGRESS"},
            {"title": "Add voiceover",                "desc": "Record and sync French/Arabic voiceover tracks",              "status": "IN_PROGRESS"},
            {"title": "Sound design",                 "desc": "Subtle ambient music + product sound FX",                     "status": "TODO"},
            {"title": "Export for Instagram",         "desc": "9:16 format, max 90s, under 100MB each",                     "status": "TODO"},
            {"title": "Client review round 1",        "desc": "Send draft reels via Frame.io for feedback",                  "status": "TODO"},
        ]
    },
    {
        "name": "Ramadan Campaign 2025",
        "description": "Full social media campaign for Ramadan. 30 posts, 10 reels, email sequence, and landing page.",
        "dept": 2,
        "employees": [8, 9, 10, 11, 12],
        "start_offset": -30,
        "deadline_offset": -5,
        "tasks": [
            {"title": "Campaign concept & moodboard",  "desc": "Define visual identity, color palette, tone of voice",       "status": "DONE"},
            {"title": "Content calendar",              "desc": "Map 30 days of posts across platforms",                      "status": "DONE"},
            {"title": "Design 30 static posts",        "desc": "Stories + feed posts in brand template",                     "status": "DONE"},
            {"title": "Produce 10 Ramadan reels",      "desc": "Mix of recipes, tips, and brand storytelling",               "status": "DONE"},
            {"title": "Write email sequence (7 emails)","desc": "Welcome, mid-Ramadan, Eid offer, follow-up",                "status": "DONE"},
            {"title": "Build landing page",            "desc": "Single-page Ramadan offer with countdown timer",             "status": "DONE"},
            {"title": "Schedule all content",          "desc": "Use Buffer to schedule all 30 days",                         "status": "DONE"},
            {"title": "Performance report",            "desc": "Compile reach, engagement, and conversion report",           "status": "IN_PROGRESS"},
        ]
    },
    {
        "name": "SaaS Dashboard UI Kit",
        "description": "Design and develop a reusable UI component library for a B2B SaaS client.",
        "dept": 5,
        "employees": [15, 16, 17],
        "start_offset": -15,
        "deadline_offset": 20,
        "tasks": [
            {"title": "Define design tokens",          "desc": "Colors, typography, spacing, border radius scales",          "status": "DONE"},
            {"title": "Design component library",      "desc": "50+ components in Figma: buttons, inputs, tables, modals",  "status": "DONE"},
            {"title": "Build React component library", "desc": "Storybook setup + all components in TypeScript",            "status": "IN_PROGRESS"},
            {"title": "Dashboard page — Analytics",    "desc": "Charts, KPIs, date pickers, export buttons",                "status": "IN_PROGRESS"},
            {"title": "Dashboard page — Users",        "desc": "Table with filters, pagination, bulk actions",              "status": "TODO"},
            {"title": "Dashboard page — Settings",     "desc": "Profile, billing, team management",                         "status": "TODO"},
            {"title": "Mobile responsive pass",        "desc": "Ensure all pages work on 375px–1440px",                     "status": "TODO"},
            {"title": "QA & bug fixing",               "desc": "Cross-browser testing on Chrome, Safari, Firefox",          "status": "TODO"},
            {"title": "Documentation",                 "desc": "Write usage docs for each component",                       "status": "TODO"},
        ]
    },
    {
        "name": "Real Estate Photo Pack",
        "description": "400 photos for a luxury real estate developer. Exterior, interior, and aerial shots.",
        "dept": 6,
        "employees": [18, 19],
        "start_offset": -10,
        "deadline_offset": 5,
        "tasks": [
            {"title": "Pre-shoot location scouting",   "desc": "Visit 4 properties, plan shot list per room",               "status": "DONE"},
            {"title": "Exterior shoot — Villa A",      "desc": "Golden hour shots, drone angles",                           "status": "DONE"},
            {"title": "Interior shoot — Villa A",      "desc": "Living room, kitchen, bedrooms, bathrooms",                 "status": "DONE"},
            {"title": "Exterior shoot — Villa B",      "desc": "Poolside, garden, gate",                                    "status": "IN_PROGRESS"},
            {"title": "Interior shoot — Villa B",      "desc": "Full property walkthrough",                                 "status": "TODO"},
            {"title": "Aerial drone shots",            "desc": "Neighborhood overview, roof terrace",                       "status": "TODO"},
            {"title": "Photo retouching — batch 1",    "desc": "200 photos: sky replacement, exposure correction",          "status": "TODO"},
            {"title": "Photo retouching — batch 2",    "desc": "200 photos: color grade, remove distractions",             "status": "TODO"},
            {"title": "Deliver via Google Drive",      "desc": "Organized folders per property, 2 sizes each",             "status": "TODO"},
        ]
    },
    {
        "name": "Brand Identity — EcoWear",
        "description": "Full brand identity for a sustainable fashion startup. Logo, guidelines, and packaging.",
        "dept": 1,
        "employees": [5, 6, 7],
        "start_offset": -25,
        "deadline_offset": 0,
        "tasks": [
            {"title": "Brand discovery workshop",      "desc": "2h call with client to define values, audience, tone",      "status": "DONE"},
            {"title": "Competitor analysis",           "desc": "Audit 10 sustainable fashion brands",                       "status": "DONE"},
            {"title": "Logo design — 3 concepts",      "desc": "Present 3 distinct directions with rationale",              "status": "DONE"},
            {"title": "Logo refinement",               "desc": "Refine chosen concept based on client feedback",            "status": "DONE"},
            {"title": "Color palette & typography",    "desc": "Primary + secondary palette, 2 font pairs",                 "status": "DONE"},
            {"title": "Brand guidelines PDF",          "desc": "40-page document covering all usage rules",                 "status": "IN_PROGRESS"},
            {"title": "Packaging design — tag",        "desc": "Hang tag front/back design for garments",                   "status": "IN_PROGRESS"},
            {"title": "Packaging design — bag",        "desc": "Kraft paper bag with logo emboss",                          "status": "TODO"},
            {"title": "Social media templates",        "desc": "10 Canva/Figma templates for Instagram",                    "status": "TODO"},
        ]
    },
    {
        "name": "Motion Intro Pack — Agency Showreel",
        "description": "Animated intro/outro and lower thirds for the agency's 2025 showreel video.",
        "dept": 7,
        "employees": [20, 21],
        "start_offset": -8,
        "deadline_offset": 15,
        "tasks": [
            {"title": "Storyboard intro sequence",     "desc": "10s animated agency intro with logo reveal",                "status": "DONE"},
            {"title": "Design style frames",           "desc": "5 key frames showing motion style",                         "status": "DONE"},
            {"title": "Animate logo reveal",           "desc": "After Effects: 3 variations (dark, light, transparent)",    "status": "IN_PROGRESS"},
            {"title": "Lower thirds — 10 variants",   "desc": "Name cards, location tags, stat callouts",                  "status": "TODO"},
            {"title": "Outro sequence",                "desc": "15s call-to-action outro with links",                       "status": "TODO"},
            {"title": "Export final assets",           "desc": "ProRes 4444 + H.264 versions",                              "status": "TODO"},
        ]
    },
    {
        "name": "Google Ads Campaign — AutoLux",
        "description": "Paid search and display campaign for a luxury car dealership. 3-month run.",
        "dept": 4,
        "employees": [13, 14, 11, 12],
        "start_offset": -40,
        "deadline_offset": 50,
        "tasks": [
            {"title": "Keyword research",              "desc": "500+ keywords across 8 ad groups",                          "status": "DONE"},
            {"title": "Competitor ad audit",           "desc": "Analyze top 5 competitor Google Ads",                       "status": "DONE"},
            {"title": "Write ad copy — 5 variants",   "desc": "Headlines + descriptions for A/B testing",                  "status": "DONE"},
            {"title": "Design display banners",        "desc": "10 sizes for GDN: 728x90, 300x250, 160x600...",            "status": "DONE"},
            {"title": "Campaign setup in Google Ads",  "desc": "Campaigns, ad groups, bidding strategy",                    "status": "DONE"},
            {"title": "Tracking & conversion setup",   "desc": "GTM, GA4 events, phone call tracking",                     "status": "DONE"},
            {"title": "Week 1–4 optimization",         "desc": "Pause underperforming keywords, adjust bids",               "status": "DONE"},
            {"title": "Week 5–8 optimization",         "desc": "Expand winning ad groups, test new creatives",             "status": "IN_PROGRESS"},
            {"title": "Month 2 performance report",    "desc": "CTR, CPC, conversions, ROAS analysis",                     "status": "TODO"},
            {"title": "Retargeting campaign setup",    "desc": "RLSA + display retargeting for site visitors",             "status": "TODO"},
        ]
    },
    {
        "name": "Product Launch — NovaSkin",
        "description": "360° launch campaign for a skincare brand's new serum line across Instagram, TikTok, and email.",
        "dept": 2,
        "employees": [8, 9, 3, 11, 15],
        "start_offset": -5,
        "deadline_offset": 30,
        "tasks": [
            {"title": "Launch strategy document",      "desc": "Define channels, timeline, KPIs, budget split",             "status": "DONE"},
            {"title": "Shoot product photos",          "desc": "White bg + lifestyle shots for 3 SKUs",                    "status": "DONE"},
            {"title": "Produce hero reel",             "desc": "60s cinematic product reveal reel",                         "status": "IN_PROGRESS"},
            {"title": "TikTok content (5 videos)",     "desc": "Trending audio, before/after, skincare routine",            "status": "IN_PROGRESS"},
            {"title": "Influencer brief (10 creators)","desc": "Prepare brief, gifting list, posting guidelines",           "status": "TODO"},
            {"title": "Email launch sequence",         "desc": "Teaser → launch day → post-launch (4 emails)",             "status": "TODO"},
            {"title": "Instagram Stories sequence",    "desc": "7-day countdown story pack",                                "status": "TODO"},
            {"title": "Press release",                 "desc": "Write and distribute to 20 beauty journalists",            "status": "TODO"},
        ]
    },
]

projects = []
for p in projects_raw:
    task_objects = []
    for t in p["tasks"]:
        completed_by = None
        completed_at = None
        if t["status"] == "DONE":
            completed_by = users[p["employees"][0]]
            completed_at = now - datetime.timedelta(days=random.randint(1, 10))
        pt = ProjectTask(
            id=bson.ObjectId(),
            title=t["title"],
            description=t["desc"],
            status=t["status"],
            deadline=now + datetime.timedelta(days=random.randint(1, 14)),
            completed_by=completed_by,
            completed_at=completed_at,
        )
        task_objects.append(pt)

    proj = Project(
        name=p["name"],
        description=p["description"],
        employees=[users[i] for i in p["employees"]],
        department=departments[p["dept"]],
        start_date=now + datetime.timedelta(days=p["start_offset"]),
        deadline=now + datetime.timedelta(days=p["deadline_offset"]),
        tasks=task_objects,
    )
    proj.save()
    projects.append(proj)

print(f"✅ {len(projects)} projects created")

# ─────────────────────────────────────────
# 5. TASKS (personal task board)
# ─────────────────────────────────────────

personal_tasks = [
    {"title": "Review client brief for NovaSkin",        "desc": "Read 20-page brief and highlight key deliverables",    "status": "DONE",        "user": 8},
    {"title": "Update portfolio with Q1 projects",       "desc": "Add 6 new case studies to Notion portfolio",           "status": "DONE",        "user": 5},
    {"title": "Export Ramadan reels in 4K",              "desc": "Re-export 10 reels at 4K for client archive",          "status": "DONE",        "user": 2},
    {"title": "Prepare onboarding doc for new hire",     "desc": "Create welcome pack for junior designer starting Mon", "status": "IN_PROGRESS", "user": 6},
    {"title": "Fix carousel bug on client dashboard",    "desc": "Images not loading on Safari 16.x",                    "status": "IN_PROGRESS", "user": 16},
    {"title": "Write Q2 content strategy doc",           "desc": "3-month plan for AutoLux social channels",             "status": "IN_PROGRESS", "user": 13},
    {"title": "Retouch 50 product photos",               "desc": "Batch retouch NovaSkin product images in Lightroom",   "status": "TODO",        "user": 18},
    {"title": "Record voiceover for showreel",           "desc": "Agency showreel narration — 90s script",               "status": "TODO",        "user": 20},
    {"title": "Research TikTok trends — beauty niche",   "desc": "Compile top 20 trending sounds and formats",           "status": "TODO",        "user": 9},
    {"title": "Set up Google Analytics 4 for EcoWear",  "desc": "Install GA4 + configure e-commerce events",            "status": "TODO",        "user": 17},
    {"title": "Proofread AutoLux ad copy",               "desc": "Final check before campaign goes live",                 "status": "DONE",        "user": 11},
    {"title": "Create Figma prototype for settings page","desc": "Interactive prototype for client walkthrough",          "status": "IN_PROGRESS", "user": 15},
    {"title": "Source music for perfume reels",          "desc": "Find 3 royalty-free tracks from Artlist",               "status": "TODO",        "user": 3},
    {"title": "Draft blog post: Ramadan marketing tips", "desc": "1200-word SEO article for agency blog",                 "status": "TODO",        "user": 12},
    {"title": "Shoot BTS content for agency Instagram",  "desc": "Behind-the-scenes of EcoWear shoot",                   "status": "DONE",        "user": 19},
]

for t in personal_tasks:
    task = Task(
        title=t["title"],
        description=t["desc"],
        status=t["status"],
        employee=users[t["user"]],
    )
    task.save()

print(f"✅ {len(personal_tasks)} personal tasks created")

# ─────────────────────────────────────────
# 6. MEETINGS
# ─────────────────────────────────────────

meetings_data = [
    {
        "title": "Product Launch Sync: Q3 Velocity",
        "desc": "Align all teams on the NovaSkin launch timeline, assign owners per deliverable.",
        "offset_days": 0, "offset_hours": 14,
        "depts": [0, 1, 2], "employees": [2, 5, 8, 13],
        "creator": 0,
    },
    {
        "title": "Weekly Creative Review",
        "desc": "Review all work-in-progress creatives across Video, Design, and Motion.",
        "offset_days": 1, "offset_hours": 10,
        "depts": [0, 1, 7], "employees": [2, 3, 5, 6, 20, 21],
        "creator": 1,
    },
    {
        "title": "AutoLux Campaign Performance Review",
        "desc": "Analyze week 5–8 Google Ads performance and agree on optimizations.",
        "offset_days": 2, "offset_hours": 11,
        "depts": [4], "employees": [13, 14, 0],
        "creator": 0,
    },
    {
        "title": "EcoWear Brand Presentation",
        "desc": "Present final brand guidelines to client. Prepare PDF and Figma walkthrough.",
        "offset_days": 3, "offset_hours": 15,
        "depts": [1], "employees": [5, 6, 7, 0],
        "creator": 1,
    },
    {
        "title": "SaaS Dashboard Sprint Planning",
        "desc": "Sprint 3 kickoff: assign tickets, estimate story points, set 2-week goals.",
        "offset_days": 1, "offset_hours": 9,
        "depts": [5], "employees": [15, 16, 17, 0],
        "creator": 0,
    },
    {
        "title": "Ramadan Campaign Debrief",
        "desc": "What worked, what didn't. Key learnings for next year's campaign.",
        "offset_days": -2, "offset_hours": 16,
        "depts": [2, 3], "employees": [8, 9, 10, 11, 12],
        "creator": 1,
    },
    {
        "title": "All Hands — Agency Monthly Update",
        "desc": "CEO update on agency performance, new clients, hiring plans, and Q3 OKRs.",
        "offset_days": 5, "offset_hours": 10,
        "depts": [0,1,2,3,4,5,6,7], "employees": list(range(22)),
        "creator": 0,
    },
    {
        "title": "Photography Brief — Villa B Shoot",
        "desc": "Prep session before the Villa B interior shoot. Review shot list and lighting plan.",
        "offset_days": 1, "offset_hours": 8,
        "depts": [6], "employees": [18, 19, 0],
        "creator": 0,
    },
    {
        "title": "Showreel Feedback Session",
        "desc": "Internal review of agency showreel cut. Collect feedback before client submission.",
        "offset_days": 4, "offset_hours": 13,
        "depts": [0, 7], "employees": [2, 3, 4, 20, 21],
        "creator": 1,
    },
    {
        "title": "NovaSkin Influencer Strategy Call",
        "desc": "Define influencer tiers, gifting budget, posting schedule, and tracking links.",
        "offset_days": 2, "offset_hours": 17,
        "depts": [2, 4], "employees": [8, 9, 13, 14],
        "creator": 0,
    },
]

for m in meetings_data:
    meeting_dt = now + datetime.timedelta(days=m["offset_days"], hours=m["offset_hours"])
    meeting_dt = meeting_dt.replace(minute=0, second=0)
    meeting = Meeting(
        title=m["title"],
        description=m["desc"],
        date_time=meeting_dt,
        departments=[departments[i] for i in m["depts"]],
        employees=[users[i] for i in m["employees"] if i < len(users)],
        created_by=users[m["creator"]],
        created_at=now - datetime.timedelta(days=random.randint(1, 5)),
    )
    meeting.save()

print(f"✅ {len(meetings_data)} meetings created")
print("\n🎉 All seed data inserted successfully!")
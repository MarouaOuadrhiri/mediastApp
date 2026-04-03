from django.apps import AppConfig

class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'users'

    def ready(self):
        import sys
        if 'runserver' not in sys.argv:
            return
        
        from .models import User
        from django.contrib.auth.hashers import make_password
        try:
            if User.objects(role='ADMIN').count() == 0:
                User(
                    username='admin',
                    email='admin@admin.com',
                    password=make_password('admin'),
                    role='ADMIN'
                ).save()
                print("Default ADMIN user created successfully.")
        except Exception:
            pass

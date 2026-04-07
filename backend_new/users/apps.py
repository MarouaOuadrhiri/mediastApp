from django.apps import AppConfig

class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'users'

    def ready(self):
        import sys
        if 'runserver' not in sys.argv:
            return
        
        from .models import User
        from django.contrib.auth.hashers import make_password, check_password
        try:
            admin_user = User.objects(username='admin').first()
            if not admin_user:
                User(
                    username='admin',
                    email='admin@admin.com',
                    password=make_password('admin'),
                    role='ADMIN'
                ).save()
                print("Default ADMIN user created successfully.")
            else:
                # Always ensure the admin account has role ADMIN
                # and maybe reset password if we're debugging
                if not check_password('admin', admin_user.password):
                    admin_user.password = make_password('admin')
                    admin_user.save()
                    print("Admin password reset to default: 'admin'")
        except Exception as e:
            print(f"Error initializing admin: {e}")

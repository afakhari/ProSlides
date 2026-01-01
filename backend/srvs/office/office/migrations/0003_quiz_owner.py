from django.db import migrations, models
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('office', '0002_option_votes_positive'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='quiz',
            name='owner',
            field=models.ForeignKey(blank=True, null=True, on_delete=models.deletion.CASCADE, related_name='quizzes', to=settings.AUTH_USER_MODEL),
        ),
    ]

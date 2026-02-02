from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("office", "0013_alter_quiz_access_code"),
    ]

    operations = [
        migrations.AlterField(
            model_name="quiz",
            name="background_color",
            field=models.CharField(default="#1e1e2e", max_length=7),
        ),
    ]

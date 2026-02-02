from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("office", "0016_alter_quiz_background_defaults"),
    ]

    operations = [
        migrations.AddField(
            model_name="quiz",
            name="text_color",
            field=models.CharField(default="#111827", max_length=7),
        ),
    ]

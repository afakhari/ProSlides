from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("office", "0015_alter_quiz_background_image_default"),
    ]

    operations = [
        migrations.AlterField(
            model_name="quiz",
            name="background_color",
            field=models.CharField(default="#f7f7fb", max_length=7),
        ),
        migrations.AlterField(
            model_name="quiz",
            name="background_image_url",
            field=models.URLField(blank=True, max_length=500, null=True),
        ),
    ]

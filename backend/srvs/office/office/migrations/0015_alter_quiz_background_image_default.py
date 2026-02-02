from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("office", "0014_alter_quiz_background_color"),
    ]

    operations = [
        migrations.AlterField(
            model_name="quiz",
            name="background_image_url",
            field=models.URLField(blank=True, default="/bg.jpg", max_length=500, null=True),
        ),
    ]

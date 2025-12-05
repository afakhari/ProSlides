from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('office', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='option',
            name='votes',
            field=models.PositiveIntegerField(default=0),
        ),
    ]

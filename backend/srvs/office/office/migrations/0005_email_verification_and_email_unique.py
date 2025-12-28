from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def add_email_unique_index(apps, schema_editor):
    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(app_label, model_name)
    table = User._meta.db_table
    index_name = f"{table}_email_unique"
    schema_editor.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS {index} ON {table} (email);".format(
            index=schema_editor.quote_name(index_name),
            table=schema_editor.quote_name(table),
        )
    )


def remove_email_unique_index(apps, schema_editor):
    app_label, model_name = settings.AUTH_USER_MODEL.split(".")
    User = apps.get_model(app_label, model_name)
    table = User._meta.db_table
    index_name = f"{table}_email_unique"
    schema_editor.execute(
        "DROP INDEX IF EXISTS {index};".format(
            index=schema_editor.quote_name(index_name),
        )
    )


class Migration(migrations.Migration):

    dependencies = [
        ("office", "0004_quiz_access_code_not_null"),
        ("office", "0004_user_id_fields"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="EmailVerification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(blank=True, max_length=6, null=True)),
                ("attempts", models.PositiveSmallIntegerField(default=0)),
                ("is_verified", models.BooleanField(default=False)),
                ("sent_at", models.DateTimeField(auto_now=True)),
                ("expires_at", models.DateTimeField()),
                ("verified_at", models.DateTimeField(blank=True, null=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="email_verification",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.RunPython(add_email_unique_index, remove_email_unique_index),
    ]

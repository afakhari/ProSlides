import uuid
from django.db import migrations, models, connection


def ensure_user_id_columns(apps, schema_editor):
    PlayerSession = apps.get_model("office", "PlayerSession")
    Leaderboard = apps.get_model("office", "Leaderboard")

    def column_exists(table, column):
        with connection.cursor() as cursor:
            cols = [col.name for col in connection.introspection.get_table_description(cursor, table)]
        return column in cols

    rust_ps_exists = column_exists(PlayerSession._meta.db_table, "rust_session_id")
    rust_lb_exists = column_exists(Leaderboard._meta.db_table, "rust_session_id")

    # Ensure columns exist (add if missing)
    if not column_exists(PlayerSession._meta.db_table, "user_id"):
        field = models.CharField(max_length=255, null=True)
        field.set_attributes_from_name("user_id")
        schema_editor.add_field(PlayerSession, field)

    if not column_exists(Leaderboard._meta.db_table, "user_id"):
        field = models.CharField(max_length=255, null=True)
        field.set_attributes_from_name("user_id")
        schema_editor.add_field(Leaderboard, field)

    # Backfill PlayerSession
    if rust_ps_exists:
        for session in PlayerSession.objects.all():
            if not session.user_id:
                rust_val = getattr(session, "rust_session_id", None)
                session.user_id = rust_val or f"user-{uuid.uuid4()}"
                session.save(update_fields=["user_id"])
    else:
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT id, user_id FROM {PlayerSession._meta.db_table}")
            rows = cursor.fetchall()
        for row_id, user_id in rows:
            if user_id:
                continue
            new_val = f"user-{uuid.uuid4()}"
            PlayerSession.objects.filter(pk=row_id).update(user_id=new_val)

    # Backfill Leaderboard
    if rust_lb_exists:
        for entry in Leaderboard.objects.all():
            if not entry.user_id:
                rust_val = getattr(entry, "rust_session_id", None)
                entry.user_id = rust_val or f"user-{uuid.uuid4()}"
                entry.save(update_fields=["user_id"])
    else:
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT id, user_id FROM {Leaderboard._meta.db_table}")
            rows = cursor.fetchall()
        for row_id, user_id in rows:
            if user_id:
                continue
            new_val = f"user-{uuid.uuid4()}"
            Leaderboard.objects.filter(pk=row_id).update(user_id=new_val)

    # Ensure unique constraints on user_id fields
    with connection.cursor() as cursor:
        cursor.execute(
            f"CREATE UNIQUE INDEX IF NOT EXISTS office_playersession_user_id_uniq ON {PlayerSession._meta.db_table}(user_id)"
        )
        cursor.execute(
            f"CREATE UNIQUE INDEX IF NOT EXISTS office_leaderboard_question_user_id_uniq ON {Leaderboard._meta.db_table}(question_id, user_id)"
        )


class Migration(migrations.Migration):

    dependencies = [
        ('office', '0003_quiz_owner'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(ensure_user_id_columns, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='playersession',
                    name='user_id',
                    field=models.CharField(max_length=255, unique=True),
                ),
                migrations.AddField(
                    model_name='leaderboard',
                    name='user_id',
                    field=models.CharField(max_length=255),
                ),
                migrations.RemoveField(
                    model_name='playersession',
                    name='rust_session_id',
                ),
                migrations.RemoveField(
                    model_name='leaderboard',
                    name='rust_session_id',
                ),
                migrations.AlterUniqueTogether(
                    name='leaderboard',
                    unique_together={('question', 'user_id')},
                ),
            ],
        ),
    ]

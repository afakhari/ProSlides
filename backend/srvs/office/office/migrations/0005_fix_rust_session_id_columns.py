from django.db import migrations


def rename_user_id_columns(apps, schema_editor):
    PlayerSession = apps.get_model("office", "PlayerSession")
    Leaderboard = apps.get_model("office", "Leaderboard")
    connection = schema_editor.connection

    def column_names(table):
        with connection.cursor() as cursor:
            return {col.name for col in connection.introspection.get_table_description(cursor, table)}

    def rename_column(table, old_name, new_name):
        schema_editor.execute(
            "ALTER TABLE {table} RENAME COLUMN {old} TO {new}".format(
                table=schema_editor.quote_name(table),
                old=schema_editor.quote_name(old_name),
                new=schema_editor.quote_name(new_name),
            )
        )

    ps_table = PlayerSession._meta.db_table
    lb_table = Leaderboard._meta.db_table

    ps_columns = column_names(ps_table)
    if "user_id" in ps_columns and "rust_session_id" not in ps_columns:
        rename_column(ps_table, "user_id", "rust_session_id")

    lb_columns = column_names(lb_table)
    if "user_id" in lb_columns and "rust_session_id" not in lb_columns:
        rename_column(lb_table, "user_id", "rust_session_id")

    with connection.cursor() as cursor:
        cursor.execute("DROP INDEX IF EXISTS office_playersession_user_id_uniq")
        cursor.execute("DROP INDEX IF EXISTS office_leaderboard_question_user_id_uniq")
        cursor.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS office_playersession_rust_session_id_uniq "
            "ON {table}(rust_session_id)".format(table=ps_table)
        )
        cursor.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS office_leaderboard_question_rust_session_id_uniq "
            "ON {table}(question_id, rust_session_id)".format(table=lb_table)
        )


class Migration(migrations.Migration):

    dependencies = [
        ("office", "0004_quiz_access_code_not_null"),
    ]

    operations = [
        migrations.RunPython(rename_user_id_columns, migrations.RunPython.noop),
    ]

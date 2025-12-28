from django.db import migrations, models


def cleanup_session_id_fields(apps, schema_editor):
    PlayerSession = apps.get_model("office", "PlayerSession")
    Leaderboard = apps.get_model("office", "Leaderboard")
    connection = schema_editor.connection

    def column_names(table):
        with connection.cursor() as cursor:
            return {col.name for col in connection.introspection.get_table_description(cursor, table)}

    def add_column_if_missing(model, table, column, field):
        if column in column_names(table):
            return
        field.set_attributes_from_name(column)
        schema_editor.add_field(model, field)

    def drop_column_if_present(table, column):
        if column not in column_names(table):
            return
        try:
            schema_editor.execute(
                "ALTER TABLE {table} DROP COLUMN {column}".format(
                    table=schema_editor.quote_name(table),
                    column=schema_editor.quote_name(column),
                )
            )
        except Exception:
            # Best-effort cleanup to avoid breaking migrations on older engines.
            pass

    ps_table = PlayerSession._meta.db_table
    lb_table = Leaderboard._meta.db_table

    add_column_if_missing(
        PlayerSession,
        ps_table,
        "rust_session_id",
        models.CharField(max_length=255, null=True),
    )
    add_column_if_missing(
        Leaderboard,
        lb_table,
        "rust_session_id",
        models.CharField(max_length=255, null=True),
    )

    drop_column_if_present(ps_table, "user_id")
    drop_column_if_present(lb_table, "user_id")

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
        ("office", "0007_alter_option_options"),
    ]

    operations = [
        migrations.RunPython(cleanup_session_id_fields, migrations.RunPython.noop),
    ]

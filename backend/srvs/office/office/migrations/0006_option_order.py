from django.db import migrations, models


def set_option_order(apps, schema_editor):
    Option = apps.get_model("office", "Option")

    question_ids = (
        Option.objects.values_list("question_id", flat=True)
        .distinct()
    )
    for question_id in question_ids:
        options = Option.objects.filter(
            question_id=question_id
        ).order_by("id")
        for index, option in enumerate(options, start=1):
            Option.objects.filter(pk=option.pk).update(order=index)


class Migration(migrations.Migration):
    dependencies = [
        ("office", "0005_fix_rust_session_id_columns"),
    ]

    operations = [
        migrations.AddField(
            model_name="option",
            name="order",
            field=models.PositiveIntegerField(default=0),
            preserve_default=False,
        ),
        migrations.RunPython(set_option_order, migrations.RunPython.noop),
    ]

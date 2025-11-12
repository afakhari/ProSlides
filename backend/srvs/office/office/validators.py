from django.core.exceptions import ValidationError


def validate_positive_time(value):
    if value <= 0:
        raise ValidationError('زمان باید بزرگتر از صفر باشد')


def validate_reasonable_time(value):
    if value > 300:  # 5 دقیقه
        raise ValidationError('زمان نباید بیشتر از 5 دقیقه باشد')

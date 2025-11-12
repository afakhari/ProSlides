from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from .validators import validate_positive_time, validate_reasonable_time


class Quiz(models.Model):
    title = models.CharField(max_length=200)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    # فیلدهای جدید مطابق format.json
    session_id = models.CharField(max_length=100, blank=True, unique=True)
    is_active = models.BooleanField(default=False)
    current_question_order = models.IntegerField(default=0)
    default_time_per_question = models.IntegerField(
        default=30,
        validators=[validate_positive_time, validate_reasonable_time]
    )
    points_calculation = models.CharField(
        max_length=20,
        choices=[
            ('accuracy_based', 'بر اساس دقت'),
            ('time_based', 'بر اساس زمان'),
            ('fixed', 'ثابت')
        ],
        default='accuracy_based'
    )
    allow_retries = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if not self.session_id:
            import uuid
            # ایجاد session_id یکتا
            while True:
                new_session_id = str(uuid.uuid4())[:20]
                if not Quiz.objects.filter(session_id=new_session_id).exists():
                    self.session_id = new_session_id
                    break
        super().save(*args, **kwargs)

    def get_game_settings(self):
        """تنظیمات بازی مطابق format.json"""
        return {
            "time_per_question": self.default_time_per_question,
            "points_calculation": self.points_calculation,
            "allow_retries": self.allow_retries
        }

    def __str__(self):
        return self.title


class Slide(models.Model):
    quiz = models.ForeignKey(
        Quiz, on_delete=models.CASCADE, related_name='slides')
    title = models.CharField(max_length=200)
    order = models.IntegerField(default=1)

    class Meta:
        abstract = True
        ordering = ['order']

    def clean(self):
        if self.order <= 0:
            raise ValidationError(
                {'order': 'Order must be greater than zero.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.quiz.title} - {self.title}"


class QuestionSlide(Slide):
    question_text = models.TextField()

    class Meta:
        abstract = True


class PickAnswerQuestion(QuestionSlide):
    # فیلدهای زمانی و امتیازی مطابق format.json
    time_limit = models.IntegerField(null=True, blank=True)
    max_points = models.IntegerField(default=100)
    min_points = models.IntegerField(default=0)

    class Meta:
        db_table = 'quiz_pickanswerquestion'

    def __str__(self):
        return f"{self.quiz.title} - {self.title} (Multiple Choice)"

    def get_actual_time_limit(self):
        """دریافت زمان پاسخگویی واقعی (اختصاصی یا پیش‌فرض)"""
        return self.time_limit if self.time_limit is not None else self.quiz.default_time_per_question

    def get_question_data(self):
        """داده‌های سوال مطابق format.json"""
        return {
            "question_id": self.id,
            "question_order": self.order,
            "question_text": self.question_text,
            "question_type": "multiple_choice",
            "question_time": self.get_actual_time_limit(),
            "max_points": self.max_points,
            "min_points": self.min_points
        }

    def clean(self):
        super().clean()
        if self.max_points < self.min_points:
            raise ValidationError({
                'max_points': 'حداکثر امتیاز نمی‌تواند از حداقل امتیاز کمتر باشد.'
            })


class Option(models.Model):
    question = models.ForeignKey(
        PickAnswerQuestion, on_delete=models.CASCADE, related_name='options')
    text = models.CharField(max_length=200)
    is_correct = models.BooleanField(default=False)
    order = models.IntegerField(default=1)
    explanation = models.TextField(blank=True)  # توضیح گزینه مطابق format.json

    class Meta:
        ordering = ['order', 'id']
        unique_together = ['question', 'order']

    def clean(self):
        if self.order <= 0:
            raise ValidationError(
                {'order': 'Order must be greater than zero.'})

        if self.pk:
            existing = Option.objects.filter(
                question=self.question,
                order=self.order
            ).exclude(pk=self.pk)
        else:
            existing = Option.objects.filter(
                question=self.question,
                order=self.order
            )

        if existing.exists():
            raise ValidationError({
                'order': f'An option with order {self.order} already exists in this question.'
            })

    def save(self, *args, **kwargs):
        self.full_clean()
        if not self.order:
            last_order = Option.objects.filter(question=self.question).aggregate(
                models.Max('order')
            )['order__max'] or 0
            self.order = last_order + 1
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.question.title} - {self.text} (Order: {self.order})"

    def get_option_data(self):
        """داده‌های گزینه مطابق format.json"""
        return {
            "option_id": self.id,
            "option_text": self.text,
            "option_order": self.order
        }


class Participant(models.Model):
    quiz = models.ForeignKey(
        Quiz, on_delete=models.CASCADE, related_name='participants')
    name = models.CharField(max_length=100)
    avatar = models.CharField(max_length=50)  # emoji
    joined_at = models.DateTimeField(auto_now_add=True)
    session_id = models.CharField(max_length=100, blank=True)
    user_id = models.CharField(
        max_length=100, blank=True)  # UUID برای format.json
    is_host = models.BooleanField(default=False)
    total_points = models.IntegerField(default=0)

    class Meta:
        unique_together = ['quiz', 'name']

    def save(self, *args, **kwargs):
        if not self.user_id:
            import uuid
            self.user_id = str(uuid.uuid4())
        if not self.session_id:
            self.session_id = str(uuid.uuid4())[:20]
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} - {self.quiz.title}"

    def get_player_data(self):
        """داده‌های بازیکن مطابق format.json"""
        return {
            "user_id": self.user_id,
            "name": self.name,
            "character": self.avatar,
            "is_host": self.is_host,
            "total_points": self.total_points,
            "joined_at": self.joined_at.isoformat()
        }


class Answer(models.Model):
    participant = models.ForeignKey(
        Participant, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(PickAnswerQuestion, on_delete=models.CASCADE)
    selected_option = models.ForeignKey(Option, on_delete=models.CASCADE)
    answered_at = models.DateTimeField(auto_now_add=True)
    submit_time = models.FloatField(default=0)  # زمان ارسال پاسخ به ثانیه
    points_earned = models.IntegerField(default=0)

    class Meta:
        unique_together = ['participant', 'question']

    def __str__(self):
        return f"{self.participant.name} - {self.question.title}"

    def get_submission_data(self):
        """داده‌های ارسال پاسخ مطابق format.json"""
        return {
            "question_id": self.question.id,
            "user_id": self.participant.user_id,
            "submit_time": self.submit_time,
            "selected_options": [self.selected_option.id],
            "submitted_at": self.answered_at.isoformat()
        }

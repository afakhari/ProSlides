# models.py
import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


def generate_unique_code(length=8):
    import random
    import string
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))


def generate_session_code(length=6):
    import random
    import string
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))


class Quiz(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    code = models.CharField(max_length=8, unique=True,
                            default=generate_unique_code)
    owner = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='owned_quizzes')
    is_active = models.BooleanField(default=True)
    is_public = models.BooleanField(default=True)
    settings = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['owner', 'created_at']),
        ]

    def __str__(self):
        return self.title


class QuizManager(models.Model):
    class PermissionLevel(models.TextChoices):
        VIEW = 'view', 'مشاهده'
        EDIT = 'edit', 'ویرایش'
        FULL = 'full', 'مدیر کامل'

    quiz = models.ForeignKey(
        Quiz, on_delete=models.CASCADE, related_name='manager_relations')
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='managed_quizzes')
    permission_level = models.CharField(
        max_length=10, choices=PermissionLevel.choices, default=PermissionLevel.VIEW)
    can_start_session = models.BooleanField(default=False)
    can_edit_questions = models.BooleanField(default=False)
    can_view_analytics = models.BooleanField(default=False)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['quiz', 'user']
        indexes = [
            models.Index(fields=['quiz', 'user']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.quiz.title}"


class Slide(models.Model):
    class SlideType(models.TextChoices):
        MULTIPLE_CHOICE = 'multiple_choice', 'چند گزینه‌ای'
        TRUE_FALSE = 'true_false', 'صحیح/غلط'
        TEXT_ANSWER = 'text_answer', 'پاسخ متنی'
        POLL = 'poll', 'نظرسنجی'
        SLIDE = 'slide', 'اسلاید اطلاعاتی'
        LEADERBOARD = 'leaderboard', 'جدول امتیازات'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quiz = models.ForeignKey(
        Quiz, on_delete=models.CASCADE, related_name='slides')
    title = models.CharField(max_length=200)
    content = models.TextField(blank=True)
    slide_type = models.CharField(max_length=20, choices=SlideType.choices)
    order = models.PositiveIntegerField(default=0)
    time_limit = models.PositiveIntegerField(default=30)
    points = models.PositiveIntegerField(default=10)
    image = models.ImageField(upload_to='slides/', null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order']
        indexes = [
            models.Index(fields=['quiz', 'order']),
        ]

    def __str__(self):
        return f"{self.quiz.title} - {self.title}"


class SlideOption(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slide = models.ForeignKey(
        Slide, on_delete=models.CASCADE, related_name='options')
    text = models.CharField(max_length=200)
    image = models.ImageField(upload_to='options/', null=True, blank=True)
    is_correct = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.text


class QuizSession(models.Model):
    class Status(models.TextChoices):
        WAITING = 'waiting', 'در انتظار'
        ACTIVE = 'active', 'فعال'
        PAUSED = 'paused', 'متوقف شده'
        FINISHED = 'finished', 'پایان یافته'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quiz = models.ForeignKey(
        Quiz, on_delete=models.CASCADE, related_name='sessions')
    code = models.CharField(max_length=8, unique=True,
                            default=generate_session_code)
    current_slide = models.ForeignKey(
        Slide, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.WAITING)
    started_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    participant_count = models.PositiveIntegerField(default=0)

    class Meta:
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['quiz', 'started_at']),
        ]

    def __str__(self):
        return f"{self.quiz.title} - {self.code}"


class Participant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quiz = models.ForeignKey(
        Quiz, on_delete=models.CASCADE, related_name='participants')
    session_id = models.CharField(max_length=100)
    full_name = models.CharField(max_length=100)
    avatar = models.CharField(max_length=50)
    device_info = models.JSONField(default=dict, blank=True)
    total_score = models.IntegerField(default=0)
    current_streak = models.PositiveIntegerField(default=0)
    joined_at = models.DateTimeField(auto_now_add=True)
    last_active = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['quiz', 'joined_at']),
            models.Index(fields=['session_id']),
        ]

    def __str__(self):
        return self.full_name


class ParticipantAnswer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    participant = models.ForeignKey(
        Participant, on_delete=models.CASCADE, related_name='answers')
    slide = models.ForeignKey(
        Slide, on_delete=models.CASCADE, related_name='answers')
    session = models.ForeignKey(
        QuizSession, on_delete=models.CASCADE, related_name='answers')
    selected_option = models.ForeignKey(
        SlideOption, on_delete=models.SET_NULL, null=True, blank=True)
    text_answer = models.TextField(blank=True)
    is_correct = models.BooleanField(null=True)
    points_earned = models.IntegerField(default=0)
    response_time = models.FloatField()
    answered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['participant', 'slide']),
            models.Index(fields=['session', 'slide']),
        ]

    def __str__(self):
        return f"{self.participant.full_name} - {self.slide.title}"


class LeaderboardSnapshot(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        QuizSession, on_delete=models.CASCADE, related_name='leaderboard_snapshots')
    slide = models.ForeignKey(
        Slide, on_delete=models.CASCADE, related_name='leaderboard_snapshots')
    snapshot_data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['session', 'created_at']),
        ]

    def __str__(self):
        return f"Leaderboard - {self.session.code} - {self.slide.title}"


class Analytics(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quiz = models.ForeignKey(
        Quiz, on_delete=models.CASCADE, related_name='analytics')
    slide = models.ForeignKey(
        Slide, on_delete=models.CASCADE, related_name='analytics')
    total_participants = models.PositiveIntegerField(default=0)
    correct_answers = models.PositiveIntegerField(default=0)
    average_time = models.FloatField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Analytics - {self.quiz.title} - {self.slide.title}"

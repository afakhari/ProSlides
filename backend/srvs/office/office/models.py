from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError


class Quiz(models.Model):
    title = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    author = models.CharField(max_length=100, default="anonymous")
    music_url = models.URLField(
        max_length=500, blank=True, null=True)
    background_color = models.CharField(max_length=7, default='#FFFFFF')
    background_image_url = models.URLField(
        max_length=500, blank=True, null=True)

    class Meta:
        ordering = ['-created_at']


    def __str__(self):
        return self.title


class Slide(models.Model):
    SLIDE_TYPE_CHOICES = [
        (1, 'Question'),
        (2, 'Content'),
    ]

    quiz = models.ForeignKey(
        Quiz, on_delete=models.CASCADE, related_name='slides')
    slide_type = models.IntegerField(choices=SLIDE_TYPE_CHOICES)
    order = models.PositiveIntegerField()
    show_leaderboard_after = models.BooleanField(default=False)
    title = models.CharField(max_length=255, blank=True, null=True)
    content_text = models.TextField(blank=True, null=True)
    content_image_url = models.URLField(
        max_length=500, blank=True, null=True)

    class Meta:
        unique_together = ['quiz', 'order']
        ordering = ['order']

    def save(self, *args, **kwargs):
        if self.order is None:
            last_slide = Slide.objects.filter(
                quiz=self.quiz).order_by('-order').first()
            self.order = last_slide.order + 1 if last_slide else 1
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Slide {self.order} - {self.get_slide_type_display()}"


class Question(models.Model):
    QUESTION_TYPE_CHOICES = [
        ('single', 'Single Choice'),
        ('multiple', 'Multiple Choice'),
    ]

    slide = models.OneToOneField(
        Slide, on_delete=models.CASCADE, primary_key=True)
    title = models.CharField(max_length=255, blank=True, null=True)
    text = models.TextField(blank=True, null=True)
    question_type = models.CharField(
        max_length=10, choices=QUESTION_TYPE_CHOICES)
    min_point = models.IntegerField(default=0)
    max_point = models.IntegerField(default=100)
    time_limit = models.IntegerField(default=30)
    image_url = models.URLField(
        max_length=500, blank=True, null=True)
    faster_answers_more_points = models.BooleanField(default=False)
    partial_scoring = models.BooleanField(default=False)

    @property
    def id(self):
        # سازگاری با کدی که انتظار فیلد id دارد؛ pk همان slide_id است
        return self.pk

    def __str__(self):
        return self.title or f"Question for Slide {self.slide_id}"


class Option(models.Model):
    question = models.ForeignKey(
        Question, on_delete=models.CASCADE, related_name='options')
    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)
    votes = models.IntegerField(default=0)
    image_url = models.URLField(
        max_length=500, blank=True, null=True)

    def __str__(self):
        return self.text


class PlayerSession(models.Model):
    rust_session_id = models.CharField(max_length=255, unique=True)
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE)
    player_name = models.CharField(max_length=100)
    avatar = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.player_name} ({self.rust_session_id})"


class Leaderboard(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    rust_session_id = models.CharField(max_length=255)
    player_name = models.CharField(max_length=100)
    avatar = models.CharField(max_length=10)
    score = models.IntegerField()
    time_taken = models.FloatField()
    rank = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['question', 'rust_session_id']

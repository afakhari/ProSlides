from django.db import models
from django.contrib.auth.models import User


class Quiz(models.Model):
    title = models.CharField(max_length=200)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Slide(models.Model):
    quiz = models.ForeignKey(
        Quiz, on_delete=models.CASCADE, related_name='slides')
    title = models.CharField(max_length=200)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order']
        unique_together = ['quiz', 'order']

    def __str__(self):
        return f"{self.quiz.title} - {self.title}"


class Question(models.Model):
    QUESTION_TYPES = [
        ('multiple_choice', 'چند گزینه‌ای'),
        ('text', 'تشریحی'),
        ('true_false', 'صحیح/غلط'),
    ]

    slide = models.OneToOneField(
        Slide, on_delete=models.CASCADE, related_name='question')
    text = models.TextField()
    question_type = models.CharField(
        max_length=20, choices=QUESTION_TYPES, default='multiple_choice')

    def __str__(self):
        return f"{self.slide.title} - {self.text[:50]}..."


class Option(models.Model):
    question = models.ForeignKey(
        Question, on_delete=models.CASCADE, related_name='options')
    text = models.CharField(max_length=200)
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.question.slide.title} - {self.text}"


class Player(models.Model):
    quiz = models.ForeignKey(
        Quiz, on_delete=models.CASCADE, related_name='players')
    player_id = models.CharField(max_length=100)
    name = models.CharField(max_length=100)
    avatar = models.CharField(max_length=50, default='default_avatar')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['quiz', 'player_id']

    def __str__(self):
        return f"{self.name} - {self.quiz.title}"


class Leaderboard(models.Model):
    quiz = models.ForeignKey(
        Quiz, on_delete=models.CASCADE, related_name='leaderboards')
    player = models.ForeignKey(Player, on_delete=models.CASCADE)
    slide = models.ForeignKey(
        Slide, on_delete=models.CASCADE, null=True, blank=True)
    score = models.IntegerField(default=0)
    position = models.IntegerField()

    class Meta:
        ordering = ['quiz', 'slide', 'position']
        unique_together = ['quiz', 'player', 'slide']

    def __str__(self):
        if self.slide:
            return f"{self.quiz.title} - Slide {self.slide.order} - {self.player.name} - Pos: {self.position}"
        return f"{self.quiz.title} - Overall - {self.player.name} - Pos: {self.position}"

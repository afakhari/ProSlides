from django.db import models
from django.contrib.auth.models import User


class Quiz(models.Model):
    title = models.CharField(max_length=200)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Slide(models.Model):
    QUESTION_TYPES = [
        ('multiple_choice', 'چند گزینه‌ای'),
        ('text', 'تشریحی'),
        ('true_false', 'صحیح/غلط'),
    ]

    quiz = models.ForeignKey(
        Quiz, on_delete=models.CASCADE, related_name='slides')
    title = models.CharField(max_length=200)
    order = models.IntegerField(default=0)
    question_type = models.CharField(
        max_length=20, choices=QUESTION_TYPES, default='multiple_choice')

    class Meta:
        ordering = ['order']
        unique_together = ['quiz', 'order']  # جلوگیری از ترتیب تکراری

    def __str__(self):
        return f"{self.quiz.title} - {self.title} (Order: {self.order})"


class Question(models.Model):
    slide = models.OneToOneField(
        Slide, on_delete=models.CASCADE, related_name='question')
    text = models.TextField()

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
    total_score = models.IntegerField(default=0)  # امتیاز کلی در کل کوئیز
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['quiz', 'player_id']

    def __str__(self):
        return f"{self.name} - {self.quiz.title}"


class Leaderboard(models.Model):
    slide = models.ForeignKey(
        Slide, on_delete=models.CASCADE, related_name='leaderboard_entries')
    player = models.ForeignKey(Player, on_delete=models.CASCADE)
    score = models.IntegerField(default=0)  # امتیاز در این مرحله
    position = models.IntegerField()  # موقعیت در این مرحله

    class Meta:
        ordering = ['slide', 'position']
        # هر بازیکن یک رکورد در هر اسلاید
        unique_together = ['slide', 'player']

    def __str__(self):
        return f"Slide {self.slide.order} - {self.player.name} - Pos: {self.position}"

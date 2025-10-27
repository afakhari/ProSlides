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

    def __str__(self):
        return f"{self.quiz.title} - {self.title}"


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

from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError


class Quiz(models.Model):
    title = models.CharField(max_length=200)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Slide(models.Model):
    """مدل آبسترکت برای اسلایدها"""
    quiz = models.ForeignKey(
        Quiz, on_delete=models.CASCADE, related_name='slides')
    title = models.CharField(max_length=200)
    order = models.IntegerField(default=1)  # ✅ پیش‌فرض 1

    class Meta:
        abstract = True
        ordering = ['order']

    def clean(self):
        """اعتبارسنجی order"""
        if self.order <= 0:
            raise ValidationError(
                {'order': 'Order must be greater than zero.'})

        # بررسی یکتایی order در همان کوئیز
        if self.pk:  # اگر در حال آپدیت است
            existing = self.__class__.objects.filter(
                quiz=self.quiz,
                order=self.order
            ).exclude(pk=self.pk)
        else:  # اگر در حال ایجاد است
            existing = self.__class__.objects.filter(
                quiz=self.quiz,
                order=self.order
            )

        if existing.exists():
            raise ValidationError({
                'order': f'A slide with order {self.order} already exists in this quiz.'
            })

    def save(self, *args, **kwargs):
        """اعمال اعتبارسنجی قبل از ذخیره"""
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.quiz.title} - {self.title}"


class QuestionSlide(Slide):
    """اسلایدی که شامل سوال است (آبسترکت)"""
    question_text = models.TextField()

    class Meta:
        abstract = True


class PickAnswerQuestion(QuestionSlide):
    """اسلاید سوال چندگزینه‌ای - تنها مدل غیر آبسترکت"""
    class Meta:
        db_table = 'quiz_pickanswerquestion'
        # ✅ اضافه کردن unique_together برای اطمینان بیشتر
        unique_together = ['quiz', 'order']

    def __str__(self):
        return f"{self.quiz.title} - {self.title} (Multiple Choice)"


class Option(models.Model):
    """گزینه‌های سوال چندگزینه‌ای"""
    question = models.ForeignKey(
        PickAnswerQuestion, on_delete=models.CASCADE, related_name='options')
    text = models.CharField(max_length=200)
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.question.title} - {self.text}"

# models.py
import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.exceptions import ValidationError


def generate_unique_code(length=8):
    """تولید کد یکتا برای کوییز"""
    import random
    import string
    characters = string.ascii_uppercase + string.digits
    while True:
        code = ''.join(random.choices(characters, k=length))
        # اطمینان از یکتایی کد
        if not Quiz.objects.filter(code=code).exists():
            return code


def generate_session_code(length=6):
    """تولید کد یکتا برای جلسه"""
    import random
    import string
    characters = string.ascii_uppercase + string.digits
    while True:
        code = ''.join(random.choices(characters, k=length))
        # اطمینان از یکتایی کد
        if not QuizSession.objects.filter(code=code).exists():
            return code


class Quiz(models.Model):
    """مدل اصلی کوییز"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200, verbose_name="عنوان")
    description = models.TextField(blank=True, verbose_name="توضیحات")
    code = models.CharField(
        max_length=8,
        unique=True,
        default=generate_unique_code,
        verbose_name="کد کوییز"
    )
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='owned_quizzes',
        verbose_name="مالک"
    )
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    is_public = models.BooleanField(default=True, verbose_name="عمومی")
    settings = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="تنظیمات",
        help_text="تنظیمات پیشرفته کوییز"
    )
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name="تاریخ ایجاد")
    updated_at = models.DateTimeField(
        auto_now=True, verbose_name="آخرین بروزرسانی")

    class Meta:
        verbose_name = "کوییز"
        verbose_name_plural = "کوییزها"
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['owner', 'created_at']),
            models.Index(fields=['is_active', 'is_public']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.code})"

    def clean(self):
        """اعتبارسنجی مدل"""
        if len(self.title.strip()) < 2:
            raise ValidationError("عنوان کوییز باید حداقل ۲ کاراکتر باشد")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    @property
    def active_slides(self):
        """اسلایدهای فعال کوییز"""
        return self.slides.filter(is_active=True).order_by('order')

    @property
    def question_count(self):
        """تعداد سوالات فعال"""
        return self.slides.filter(
            is_active=True,
            slide_type__in=['multiple_choice', 'true_false', 'text_answer']
        ).count()


class QuizManager(models.Model):
    """مدیران کوییز با سطوح دسترسی مختلف"""

    class PermissionLevel(models.TextChoices):
        VIEW = 'view', 'مشاهده'
        EDIT = 'edit', 'ویرایش'
        FULL = 'full', 'مدیر کامل'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quiz = models.ForeignKey(
        Quiz,
        on_delete=models.CASCADE,
        related_name='manager_relations',
        verbose_name="کوییز"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='managed_quizzes',
        verbose_name="کاربر"
    )
    permission_level = models.CharField(
        max_length=10,
        choices=PermissionLevel.choices,
        default=PermissionLevel.VIEW,
        verbose_name="سطح دسترسی"
    )
    can_start_session = models.BooleanField(
        default=False, verbose_name="اجازه شروع جلسه")
    can_edit_questions = models.BooleanField(
        default=False, verbose_name="اجازه ویرایش سوالات")
    can_view_analytics = models.BooleanField(
        default=False, verbose_name="اجازه مشاهده آمار")
    added_at = models.DateTimeField(
        auto_now_add=True, verbose_name="تاریخ افزودن")

    class Meta:
        verbose_name = "مدیر کوییز"
        verbose_name_plural = "مدیران کوییز"
        unique_together = ['quiz', 'user']
        indexes = [
            models.Index(fields=['quiz', 'user']),
            models.Index(fields=['user', 'added_at']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.quiz.title}"

    def clean(self):
        """اعتبارسنجی سطح دسترسی"""
        if self.permission_level == 'full':
            self.can_start_session = True
            self.can_edit_questions = True
            self.can_view_analytics = True


class Slide(models.Model):
    """اسلایدهای کوییز"""

    class SlideType(models.TextChoices):
        MULTIPLE_CHOICE = 'multiple_choice', 'چند گزینه‌ای'
        TRUE_FALSE = 'true_false', 'صحیح/غلط'
        TEXT_ANSWER = 'text_answer', 'پاسخ متنی'
        POLL = 'poll', 'نظرسنجی'
        SLIDE = 'slide', 'اسلاید اطلاعاتی'
        LEADERBOARD = 'leaderboard', 'جدول امتیازات'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quiz = models.ForeignKey(
        Quiz,
        on_delete=models.CASCADE,
        related_name='slides',
        verbose_name="کوییز"
    )
    title = models.CharField(max_length=200, verbose_name="عنوان")
    content = models.TextField(blank=True, verbose_name="محتوا")
    slide_type = models.CharField(
        max_length=20,
        choices=SlideType.choices,
        verbose_name="نوع اسلاید"
    )
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب")
    time_limit = models.PositiveIntegerField(
        default=30,
        verbose_name="زمان پاسخ (ثانیه)",
        help_text="زمان به ثانیه"
    )
    points = models.PositiveIntegerField(
        default=10,
        verbose_name="امتیاز",
        help_text="امتیاز سوال"
    )
    image = models.ImageField(
        upload_to='slides/',
        null=True,
        blank=True,
        verbose_name="تصویر"
    )
    is_active = models.BooleanField(default=True, verbose_name="فعال")

    class Meta:
        verbose_name = "اسلاید"
        verbose_name_plural = "اسلایدها"
        ordering = ['order']
        indexes = [
            models.Index(fields=['quiz', 'order']),
            models.Index(fields=['quiz', 'slide_type']),
        ]

    def __str__(self):
        return f"{self.quiz.title} - {self.title}"

    def clean(self):
        """اعتبارسنجی اسلاید"""
        if self.order < 0:
            raise ValidationError("ترتیب نمی‌تواند منفی باشد")

        if self.time_limit < 5:
            raise ValidationError("زمان پاسخ باید حداقل ۵ ثانیه باشد")

        if self.points < 0:
            raise ValidationError("امتیاز نمی‌تواند منفی باشد")

    @property
    def has_correct_answer(self):
        """آیا این سوال پاسخ صحیح دارد؟"""
        return self.slide_type in ['multiple_choice', 'true_false']

    @property
    def correct_options(self):
        """گزینه‌های صحیح"""
        if self.has_correct_answer:
            return self.options.filter(is_correct=True)
        return SlideOption.objects.none()


class SlideOption(models.Model):
    """گزینه‌های اسلاید"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slide = models.ForeignKey(
        Slide,
        on_delete=models.CASCADE,
        related_name='options',
        verbose_name="اسلاید"
    )
    text = models.CharField(max_length=200, verbose_name="متن گزینه")
    image = models.ImageField(
        upload_to='options/',
        null=True,
        blank=True,
        verbose_name="تصویر گزینه"
    )
    is_correct = models.BooleanField(default=False, verbose_name="صحیح")
    order = models.PositiveIntegerField(default=0, verbose_name="ترتیب")

    class Meta:
        verbose_name = "گزینه"
        verbose_name_plural = "گزینه‌ها"
        ordering = ['order']
        indexes = [
            models.Index(fields=['slide', 'order']),
            models.Index(fields=['slide', 'is_correct']),
        ]

    def __str__(self):
        return f"{self.slide.title} - {self.text}"

    def clean(self):
        """اعتبارسنجی گزینه"""
        if not self.text.strip():
            raise ValidationError("متن گزینه نمی‌تواند خالی باشد")


class QuizSession(models.Model):
    """جلسه فعال کوییز"""

    class Status(models.TextChoices):
        WAITING = 'waiting', 'در انتظار'
        ACTIVE = 'active', 'فعال'
        PAUSED = 'paused', 'متوقف شده'
        FINISHED = 'finished', 'پایان یافته'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quiz = models.ForeignKey(
        Quiz,
        on_delete=models.CASCADE,
        related_name='sessions',
        verbose_name="کوییز"
    )
    code = models.CharField(
        max_length=8,
        unique=True,
        default=generate_session_code,
        verbose_name="کد جلسه"
    )
    current_slide = models.ForeignKey(
        Slide,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="اسلاید جاری"
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.WAITING,
        verbose_name="وضعیت"
    )
    started_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name="شروع شده توسط"
    )
    started_at = models.DateTimeField(
        auto_now_add=True, verbose_name="زمان شروع")
    finished_at = models.DateTimeField(
        null=True, blank=True, verbose_name="زمان پایان")
    participant_count = models.PositiveIntegerField(
        default=0, verbose_name="تعداد شرکت‌کنندگان")

    class Meta:
        verbose_name = "جلسه کوییز"
        verbose_name_plural = "جلسات کوییز"
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['quiz', 'started_at']),
            models.Index(fields=['status', 'started_at']),
        ]
        ordering = ['-started_at']

    def __str__(self):
        return f"{self.quiz.title} - {self.code}"

    def clean(self):
        """اعتبارسنجی جلسه"""
        if self.finished_at and self.started_at and self.finished_at < self.started_at:
            raise ValidationError("زمان پایان نمی‌تواند قبل از زمان شروع باشد")

    @property
    def duration(self):
        """مدت زمان جلسه"""
        if self.finished_at and self.started_at:
            return (self.finished_at - self.started_at).total_seconds()
        elif self.started_at:
            return (timezone.now() - self.started_at).total_seconds()
        return 0

    @property
    def is_live(self):
        """آیا جلسه فعال است؟"""
        return self.status in ['waiting', 'active', 'paused']


class Participant(models.Model):
    """شرکت‌کنندگان در کوییز"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quiz = models.ForeignKey(
        Quiz,
        on_delete=models.CASCADE,
        related_name='participants',
        verbose_name="کوییز"
    )
    session_id = models.CharField(
        max_length=100,
        verbose_name="شناسه جلسه",
        help_text="شناسه یکتا برای ارتباط با WebSocket"
    )
    full_name = models.CharField(max_length=100, verbose_name="نام کامل")
    avatar = models.CharField(max_length=50, verbose_name="آواتار")
    device_info = models.JSONField(
        default=dict,
        blank=True,
        verbose_name="اطلاعات دستگاه"
    )
    total_score = models.IntegerField(default=0, verbose_name="امتیاز کل")
    current_streak = models.PositiveIntegerField(
        default=0, verbose_name="تعداد پاسخ‌های صحیح متوالی")
    joined_at = models.DateTimeField(
        auto_now_add=True, verbose_name="زمان پیوستن")
    last_active = models.DateTimeField(
        auto_now=True, verbose_name="آخرین فعالیت")

    class Meta:
        verbose_name = "شرکت‌کننده"
        verbose_name_plural = "شرکت‌کنندگان"
        indexes = [
            models.Index(fields=['quiz', 'joined_at']),
            models.Index(fields=['session_id']),
            models.Index(fields=['total_score']),
        ]
        ordering = ['-total_score', 'joined_at']

    def __str__(self):
        return self.full_name

    def clean(self):
        """اعتبارسنجی شرکت‌کننده"""
        if len(self.full_name.strip()) < 2:
            raise ValidationError("نام باید حداقل ۲ کاراکتر باشد")

        if not self.avatar:
            raise ValidationError("انتخاب آواتار الزامی است")

    @property
    def correct_answers_count(self):
        """تعداد پاسخ‌های صحیح"""
        return self.answers.filter(is_correct=True).count()

    @property
    def accuracy_rate(self):
        """نرخ دقت پاسخ‌ها"""
        total_answers = self.answers.count()
        if total_answers > 0:
            return round((self.correct_answers_count / total_answers) * 100, 1)
        return 0


class ParticipantAnswer(models.Model):
    """پاسخ‌های شرکت‌کنندگان"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    participant = models.ForeignKey(
        Participant,
        on_delete=models.CASCADE,
        related_name='answers',
        verbose_name="شرکت‌کننده"
    )
    slide = models.ForeignKey(
        Slide,
        on_delete=models.CASCADE,
        related_name='answers',
        verbose_name="اسلاید"
    )
    session = models.ForeignKey(
        QuizSession,
        on_delete=models.CASCADE,
        related_name='answers',
        verbose_name="جلسه"
    )
    selected_option = models.ForeignKey(
        SlideOption,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="گزینه انتخاب شده"
    )
    text_answer = models.TextField(blank=True, verbose_name="پاسخ متنی")
    is_correct = models.BooleanField(null=True, verbose_name="صحیح")
    points_earned = models.IntegerField(
        default=0, verbose_name="امتیاز کسب شده")
    response_time = models.FloatField(verbose_name="زمان پاسخ (ثانیه)")
    answered_at = models.DateTimeField(
        auto_now_add=True, verbose_name="زمان پاسخ")

    class Meta:
        verbose_name = "پاسخ شرکت‌کننده"
        verbose_name_plural = "پاسخ‌های شرکت‌کنندگان"
        indexes = [
            models.Index(fields=['participant', 'slide']),
            models.Index(fields=['session', 'slide']),
            models.Index(fields=['is_correct']),
            models.Index(fields=['answered_at']),
        ]
        ordering = ['answered_at']

    def __str__(self):
        return f"{self.participant.full_name} - {self.slide.title}"

    def clean(self):
        """اعتبارسنجی پاسخ"""
        if self.response_time < 0:
            raise ValidationError("زمان پاسخ نمی‌تواند منفی باشد")

        if self.points_earned < 0:
            raise ValidationError("امتیاز کسب شده نمی‌تواند منفی باشد")


class LeaderboardSnapshot(models.Model):
    """اسنپ‌شات لیدربرد"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        QuizSession,
        on_delete=models.CASCADE,
        related_name='leaderboard_snapshots',
        verbose_name="جلسه"
    )
    slide = models.ForeignKey(
        Slide,
        on_delete=models.CASCADE,
        related_name='leaderboard_snapshots',
        verbose_name="اسلاید"
    )
    snapshot_data = models.JSONField(verbose_name="داده‌های لیدربرد")
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name="زمان ایجاد")

    class Meta:
        verbose_name = "اسنپ‌شات لیدربرد"
        verbose_name_plural = "اسنپ‌شات‌های لیدربرد"
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['session', 'created_at']),
            models.Index(fields=['slide', 'created_at']),
        ]

    def __str__(self):
        return f"لیدربرد {self.session.code} - {self.slide.title}"


class Analytics(models.Model):
    """داده‌های تحلیل و آمار"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quiz = models.ForeignKey(
        Quiz,
        on_delete=models.CASCADE,
        related_name='analytics',
        verbose_name="کوییز"
    )
    slide = models.ForeignKey(
        Slide,
        on_delete=models.CASCADE,
        related_name='analytics',
        verbose_name="اسلاید"
    )
    total_participants = models.PositiveIntegerField(
        default=0, verbose_name="تعداد کل شرکت‌کنندگان")
    correct_answers = models.PositiveIntegerField(
        default=0, verbose_name="پاسخ‌های صحیح")
    average_time = models.FloatField(default=0, verbose_name="زمان متوسط پاسخ")
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name="زمان ایجاد")

    class Meta:
        verbose_name = "آمار"
        verbose_name_plural = "آمار"
        indexes = [
            models.Index(fields=['quiz', 'created_at']),
            models.Index(fields=['slide']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"آمار {self.quiz.title} - {self.slide.title}"

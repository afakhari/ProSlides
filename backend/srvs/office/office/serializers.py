# serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Quiz, QuizManager, Slide, SlideOption,
    QuizSession, Participant, ParticipantAnswer,
    LeaderboardSnapshot, Analytics
)


class UserSerializer(serializers.ModelSerializer):
    """سریالایزر کاربر"""
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']
        read_only_fields = ['id', 'username']


class SlideOptionSerializer(serializers.ModelSerializer):
    """سریالایزر گزینه‌های اسلاید"""
    class Meta:
        model = SlideOption
        fields = ['id', 'text', 'image', 'is_correct', 'order']
        read_only_fields = ['id']

    def validate(self, attrs):
        """اعتبارسنجی گزینه"""
        if not attrs.get('text', '').strip():
            raise serializers.ValidationError("متن گزینه نمی‌تواند خالی باشد")
        return attrs


class SlideSerializer(serializers.ModelSerializer):
    """سریالایزر اسلاید"""
    options = SlideOptionSerializer(many=True, required=False)
    has_correct_answer = serializers.BooleanField(read_only=True)

    class Meta:
        model = Slide
        fields = [
            'id', 'title', 'content', 'slide_type', 'order',
            'time_limit', 'points', 'image', 'is_active',
            'options', 'has_correct_answer'
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        """اعتبارسنجی اسلاید"""
        slide_type = attrs.get('slide_type')
        time_limit = attrs.get('time_limit', 30)
        points = attrs.get('points', 10)

        if time_limit < 5:
            raise serializers.ValidationError(
                "زمان پاسخ باید حداقل ۵ ثانیه باشد")

        if points < 0:
            raise serializers.ValidationError("امتیاز نمی‌تواند منفی باشد")

        # اعتبارسنجی گزینه‌ها برای سوالات چندگزینه‌ای
        if slide_type in ['multiple_choice', 'true_false']:
            options = self.initial_data.get('options', [])
            if not options:
                raise serializers.ValidationError(
                    "سوالات چندگزینه‌ای باید حداقل یک گزینه داشته باشند")

            if slide_type == 'multiple_choice':
                correct_options = [
                    opt for opt in options if opt.get('is_correct')]
                if len(correct_options) == 0:
                    raise serializers.ValidationError(
                        "سوالات چندگزینه‌ای باید حداقل یک گزینه صحیح داشته باشند")

        return attrs

    def create(self, validated_data):
        """ایجاد اسلاید با گزینه‌هایش"""
        options_data = validated_data.pop('options', [])
        slide = Slide.objects.create(**validated_data)

        for option_data in options_data:
            SlideOption.objects.create(slide=slide, **option_data)

        return slide

    def update(self, instance, validated_data):
        """بروزرسانی اسلاید و گزینه‌هایش"""
        options_data = validated_data.pop('options', None)

        # بروزرسانی فیلدهای اسلاید
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # بروزرسانی گزینه‌ها اگر ارسال شده باشند
        if options_data is not None:
            # حذف گزینه‌های قدیمی
            instance.options.all().delete()

            # ایجاد گزینه‌های جدید
            for option_data in options_data:
                SlideOption.objects.create(slide=instance, **option_data)

        return instance


class QuizSerializer(serializers.ModelSerializer):
    """سریالایزر کوییز"""
    slides = SlideSerializer(many=True, read_only=True)
    owner_name = serializers.CharField(source='owner.username', read_only=True)
    owner_email = serializers.CharField(source='owner.email', read_only=True)
    question_count = serializers.IntegerField(read_only=True)
    active_slides_count = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = [
            'id', 'title', 'description', 'code', 'owner', 'owner_name', 'owner_email',
            'is_active', 'is_public', 'settings', 'created_at', 'updated_at',
            'slides', 'question_count', 'active_slides_count'
        ]
        read_only_fields = ['id', 'code', 'owner', 'created_at', 'updated_at']

    def get_active_slides_count(self, obj):
        """تعداد اسلایدهای فعال"""
        return obj.active_slides.count()

    def validate_title(self, value):
        """اعتبارسنجی عنوان"""
        if len(value.strip()) < 2:
            raise serializers.ValidationError(
                "عنوان باید حداقل ۲ کاراکتر باشد")
        return value

    def create(self, validated_data):
        """ایجاد کوییز و تنظیم مالک"""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['owner'] = request.user
        return super().create(validated_data)


class QuizManagerSerializer(serializers.ModelSerializer):
    """سریالایزر مدیران کوییز"""
    user_name = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    quiz_title = serializers.CharField(source='quiz.title', read_only=True)

    class Meta:
        model = QuizManager
        fields = [
            'id', 'user', 'user_name', 'user_email', 'quiz', 'quiz_title',
            'permission_level', 'can_start_session', 'can_edit_questions',
            'can_view_analytics', 'added_at'
        ]
        read_only_fields = ['id', 'added_at']

    def validate(self, attrs):
        """اعتبارسنجی مدیر"""
        quiz = attrs.get('quiz')
        user = attrs.get('user')

        if quiz and user:
            # کاربر نمی‌تواند مدیر خودش باشد
            if quiz.owner == user:
                raise serializers.ValidationError(
                    "مالک کوییز نمی‌تواند مدیر نیز باشد")

            # بررسی تکراری نبودن
            if QuizManager.objects.filter(quiz=quiz, user=user).exists():
                raise serializers.ValidationError(
                    "این کاربر قبلاً به عنوان مدیر اضافه شده است")

        return attrs


class QuizSessionSerializer(serializers.ModelSerializer):
    """سریالایزر جلسه کوییز"""
    quiz_title = serializers.CharField(source='quiz.title', read_only=True)
    started_by_name = serializers.CharField(
        source='started_by.username', read_only=True)
    duration = serializers.FloatField(read_only=True)
    is_live = serializers.BooleanField(read_only=True)

    class Meta:
        model = QuizSession
        fields = [
            'id', 'code', 'quiz', 'quiz_title', 'current_slide', 'status',
            'started_by', 'started_by_name', 'started_at', 'finished_at',
            'participant_count', 'duration', 'is_live'
        ]
        read_only_fields = [
            'id', 'code', 'started_at', 'finished_at', 'participant_count',
            'duration', 'is_live'
        ]


class ParticipantSerializer(serializers.ModelSerializer):
    """سریالایزر شرکت‌کننده"""
    correct_answers_count = serializers.IntegerField(read_only=True)
    accuracy_rate = serializers.FloatField(read_only=True)
    quiz_title = serializers.CharField(source='quiz.title', read_only=True)

    class Meta:
        model = Participant
        fields = [
            'id', 'quiz', 'quiz_title', 'session_id', 'full_name', 'avatar',
            'total_score', 'current_streak', 'correct_answers_count',
            'accuracy_rate', 'joined_at', 'last_active'
        ]
        read_only_fields = [
            'id', 'total_score', 'current_streak', 'correct_answers_count',
            'accuracy_rate', 'joined_at', 'last_active'
        ]

    def validate_full_name(self, value):
        """اعتبارسنجی نام کامل"""
        if len(value.strip()) < 2:
            raise serializers.ValidationError("نام باید حداقل ۲ کاراکتر باشد")
        return value

    def validate_avatar(self, value):
        """اعتبارسنجی آواتار"""
        if not value:
            raise serializers.ValidationError("انتخاب آواتار الزامی است")
        return value


class ParticipantAnswerSerializer(serializers.ModelSerializer):
    """سریالایزر پاسخ شرکت‌کننده"""
    participant_name = serializers.CharField(
        source='participant.full_name', read_only=True)
    slide_title = serializers.CharField(source='slide.title', read_only=True)
    session_code = serializers.CharField(source='session.code', read_only=True)

    class Meta:
        model = ParticipantAnswer
        fields = [
            'id', 'participant', 'participant_name', 'slide', 'slide_title',
            'session', 'session_code', 'selected_option', 'text_answer',
            'is_correct', 'points_earned', 'response_time', 'answered_at'
        ]
        read_only_fields = [
            'id', 'is_correct', 'points_earned', 'answered_at'
        ]

    def validate_response_time(self, value):
        """اعتبارسنجی زمان پاسخ"""
        if value < 0:
            raise serializers.ValidationError("زمان پاسخ نمی‌تواند منفی باشد")
        return value


class LeaderboardSnapshotSerializer(serializers.ModelSerializer):
    """سریالایزر اسنپ‌شات لیدربرد"""
    session_code = serializers.CharField(source='session.code', read_only=True)
    slide_title = serializers.CharField(source='slide.title', read_only=True)

    class Meta:
        model = LeaderboardSnapshot
        fields = [
            'id', 'session', 'session_code', 'slide', 'slide_title',
            'snapshot_data', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class AnalyticsSerializer(serializers.ModelSerializer):
    """سریالایزر آمار"""
    quiz_title = serializers.CharField(source='quiz.title', read_only=True)
    slide_title = serializers.CharField(source='slide.title', read_only=True)
    correct_percentage = serializers.SerializerMethodField()

    class Meta:
        model = Analytics
        fields = [
            'id', 'quiz', 'quiz_title', 'slide', 'slide_title',
            'total_participants', 'correct_answers', 'average_time',
            'correct_percentage', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_correct_percentage(self, obj):
        """محاسبه درصد پاسخ‌های صحیح"""
        if obj.total_participants > 0:
            return round((obj.correct_answers / obj.total_participants) * 100, 1)
        return 0


class JoinQuizSerializer(serializers.Serializer):
    """سریالایزر برای پیوستن به کوییز"""
    full_name = serializers.CharField(max_length=100)
    avatar = serializers.CharField(max_length=50)

    def validate_full_name(self, value):
        if len(value.strip()) < 2:
            raise serializers.ValidationError("نام باید حداقل ۲ کاراکتر باشد")
        return value

    def validate_avatar(self, value):
        if not value:
            raise serializers.ValidationError("انتخاب آواتار الزامی است")
        return value


class SubmitAnswerSerializer(serializers.Serializer):
    """سریالایزر برای ارسال پاسخ"""
    selected_option_id = serializers.UUIDField(required=False)
    text_answer = serializers.CharField(required=False, allow_blank=True)
    response_time = serializers.FloatField(min_value=0)

    def validate(self, attrs):
        """اعتبارسنجی پاسخ"""
        selected_option_id = attrs.get('selected_option_id')
        text_answer = attrs.get('text_answer', '')

        if not selected_option_id and not text_answer.strip():
            raise serializers.ValidationError(
                "حداقل یکی از فیلدهای selected_option_id یا text_answer باید پر شود"
            )

        return attrs

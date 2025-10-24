from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated as DRFIsAuthenticated
from django.shortcuts import get_object_or_404
from django.db import transaction, models
from django.utils import timezone
from django.db.models import Q
import logging
import uuid

from .models import (
    Quiz, QuizManager, Slide, SlideOption,
    QuizSession, Participant, ParticipantAnswer,
    LeaderboardSnapshot, Analytics
)
from .serializers import (
    QuizSerializer, QuizManagerSerializer, SlideSerializer,
    QuizSessionSerializer, ParticipantSerializer, ParticipantAnswerSerializer,
    LeaderboardSnapshotSerializer, AnalyticsSerializer,
    JoinQuizSerializer, SubmitAnswerSerializer, UserSerializer
)
from .permissions import (
    IsAuthenticated, IsQuizOwner, IsQuizOwnerOrManager,
    CanStartQuizSession, CanEditQuiz, CanViewAnalytics,
    PublicQuizReadOnly
)
from .utils import (
    calculate_points, calculate_correctness, generate_leaderboard_data,
    get_correct_answer_data, calculate_question_analytics, calculate_quiz_analytics,
    can_start_quiz, can_control_session, get_next_slide,
    validate_participant_data, handle_unanswered_questions
)

logger = logging.getLogger(__name__)


class QuizViewSet(viewsets.ModelViewSet):
    """ViewSet برای مدیریت کوییزها"""
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """دریافت کوییزهای کاربر (مالک یا مدیر)"""
        user = self.request.user

        # کوییزهایی که کاربر مالک آنهاست یا مدیر آنهاست
        owned_quizzes = Quiz.objects.filter(owner=user)
        managed_quizzes = Quiz.objects.filter(manager_relations__user=user)

        queryset = (owned_quizzes | managed_quizzes).distinct().prefetch_related(
            'slides', 'slides__options'
        )

        # فیلتر بر اساس وضعیت فعال
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        # جستجو بر اساس عنوان
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(title__icontains=search)

        return queryset

    def get_permissions(self):
        """تعیین permission بر اساس action"""
        if self.action in ['create']:
            return [IsAuthenticated()]
        elif self.action in ['update', 'partial_update', 'destroy']:
            return [IsQuizOwner()]
        elif self.action in ['retrieve']:
            return [IsQuizOwnerOrManager() | PublicQuizReadOnly()]
        elif self.action in ['list']:
            return [IsAuthenticated()]
        return super().get_permissions()

    def perform_create(self, serializer):
        """ایجاد کوییز با مالک فعلی"""
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[IsQuizOwner])
    def toggle_active(self, request, pk=None):
        """فعال/غیرفعال کردن کوییز"""
        quiz = self.get_object()
        quiz.is_active = not quiz.is_active
        quiz.save()

        return Response({
            'status': 'success',
            'is_active': quiz.is_active,
            'message': f'کوییز {"فعال" if quiz.is_active else "غیرفعال"} شد'
        })

    @action(detail=True, methods=['get'], permission_classes=[IsQuizOwnerOrManager])
    def statistics(self, request, pk=None):
        """آمار کلی کوییز"""
        quiz = self.get_object()

        stats = {
            'total_slides': quiz.slides.count(),
            'active_slides': quiz.active_slides.count(),
            'total_sessions': quiz.sessions.count(),
            'active_sessions': quiz.sessions.filter(status__in=['waiting', 'active']).count(),
            'total_participants': quiz.participants.count(),
            'average_participants_per_session': 0,
        }

        # محاسبه میانگین شرکت‌کنندگان در هر جلسه
        session_count = quiz.sessions.count()
        if session_count > 0:
            total_participants = sum(
                session.participant_count for session in quiz.sessions.all())
            stats['average_participants_per_session'] = round(
                total_participants / session_count, 1)

        return Response(stats)

    @action(detail=True, methods=['post'], permission_classes=[IsQuizOwner])
    def duplicate(self, request, pk=None):
        """تکثیر کوییز"""
        from .serializers import QuizSerializer  # Import داخلی برای جلوگیری از circular import

        original_quiz = self.get_object()

        with transaction.atomic():
            # ایجاد کوییز جدید
            new_quiz = Quiz.objects.create(
                title=f"{original_quiz.title} (کپی)",
                description=original_quiz.description,
                owner=request.user,
                is_public=original_quiz.is_public,
                settings=original_quiz.settings
            )

            # تکثیر اسلایدها و گزینه‌ها
            for slide in original_quiz.slides.all():
                new_slide = Slide.objects.create(
                    quiz=new_quiz,
                    title=slide.title,
                    content=slide.content,
                    slide_type=slide.slide_type,
                    order=slide.order,
                    time_limit=slide.time_limit,
                    points=slide.points,
                    image=slide.image,
                    is_active=slide.is_active
                )

                for option in slide.options.all():
                    SlideOption.objects.create(
                        slide=new_slide,
                        text=option.text,
                        image=option.image,
                        is_correct=option.is_correct,
                        order=option.order
                    )

        serializer = QuizSerializer(new_quiz)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class QuizManagerViewSet(viewsets.ModelViewSet):
    """ViewSet برای مدیریت مدیران کوییز"""
    serializer_class = QuizManagerSerializer
    permission_classes = [IsQuizOwner]

    def get_queryset(self):
        """دریافت مدیران کوییز"""
        quiz_id = self.kwargs.get('quiz_id')
        return QuizManager.objects.filter(quiz_id=quiz_id).select_related('user')

    def get_serializer_context(self):
        """اضافه کردن context به سریالایزر"""
        context = super().get_serializer_context()
        context['quiz'] = get_object_or_404(
            Quiz, id=self.kwargs.get('quiz_id'))
        return context

    def perform_create(self, serializer):
        """ایجاد مدیر با تنظیم خودکار کوییز"""
        from rest_framework import serializers

        quiz_id = self.kwargs.get('quiz_id')
        quiz = get_object_or_404(Quiz, id=quiz_id)
        user = serializer.validated_data['user']

        # بررسی اینکه کاربر مالک نباشد
        if quiz.owner == user:
            raise serializers.ValidationError(
                {"user": "مالک کوییز نمی‌تواند مدیر نیز باشد"})

        # بررسی تکراری نبودن
        if QuizManager.objects.filter(quiz=quiz, user=user).exists():
            raise serializers.ValidationError(
                {"user": "این کاربر قبلاً به عنوان مدیر اضافه شده است"})

        serializer.save(quiz=quiz)


class SlideViewSet(viewsets.ModelViewSet):
    """ViewSet برای مدیریت اسلایدها"""
    serializer_class = SlideSerializer
    permission_classes = [CanEditQuiz]

    def get_queryset(self):
        """دریافت اسلایدهای کوییز"""
        quiz_id = self.kwargs.get('quiz_id')
        return Slide.objects.filter(quiz_id=quiz_id).prefetch_related('options').order_by('order')

    def get_serializer_context(self):
        """اضافه کردن context به سریالایزر"""
        context = super().get_serializer_context()
        context['quiz'] = get_object_or_404(
            Quiz, id=self.kwargs.get('quiz_id'))
        return context

    def perform_create(self, serializer):
        """ایجاد اسلاید با تنظیم خودکار کوییز"""
        quiz_id = self.kwargs.get('quiz_id')
        quiz = get_object_or_404(Quiz, id=quiz_id)

        # تعیین ترتیب خودکار اگر مشخص نشده
        if not serializer.validated_data.get('order'):
            max_order = Slide.objects.filter(quiz=quiz).aggregate(
                models.Max('order'))['order__max'] or 0
            serializer.validated_data['order'] = max_order + 1

        serializer.save(quiz=quiz)

    @action(detail=True, methods=['post'], permission_classes=[CanEditQuiz])
    def move(self, request, quiz_id=None, pk=None):
        """تغییر ترتیب اسلاید"""
        from .serializers import SlideSerializer

        slide = self.get_object()
        new_order = request.data.get('order')

        if new_order is None:
            return Response(
                {'error': 'فیلد order الزامی است'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            new_order = int(new_order)
        except (TypeError, ValueError):
            return Response(
                {'error': 'order باید یک عدد باشد'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # تغییر ترتیب اسلایدها
        slides = Slide.objects.filter(quiz_id=quiz_id).order_by('order')

        with transaction.atomic():
            if new_order < slide.order:
                # حرکت به بالا
                slides.filter(
                    order__gte=new_order,
                    order__lt=slide.order
                ).update(order=models.F('order') + 1)
            else:
                # حرکت به پایین
                slides.filter(
                    order__gt=slide.order,
                    order__lte=new_order
                ).update(order=models.F('order') - 1)

            slide.order = new_order
            slide.save()

        return Response({'status': 'ترتیب اسلاید تغییر کرد', 'new_order': slide.order})


class QuizSessionViewSet(viewsets.ModelViewSet):
    """ViewSet برای مدیریت جلسات کوییز"""
    serializer_class = QuizSessionSerializer
    permission_classes = [CanStartQuizSession]

    def get_queryset(self):
        """دریافت جلسات کوییز"""
        quiz_id = self.kwargs.get('quiz_id')
        return QuizSession.objects.filter(quiz_id=quiz_id).select_related('quiz', 'current_slide')

    def perform_create(self, serializer):
        """ایجاد جلسه جدید"""
        from rest_framework import serializers

        quiz_id = self.kwargs.get('quiz_id')
        quiz = get_object_or_404(Quiz, id=quiz_id)

        # بررسی اینکه کوییز اسلاید فعال دارد
        if not quiz.active_slides.exists():
            raise serializers.ValidationError(
                "کوییز باید حداقل یک اسلاید فعال داشته باشد")

        serializer.save(quiz=quiz, started_by=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[CanStartQuizSession])
    def start(self, request, quiz_id=None, pk=None):
        """شروع جلسه"""
        from .serializers import SlideSerializer

        session = self.get_object()

        if session.status != 'waiting':
            return Response(
                {'error': 'جلسه قبلاً شروع شده است'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # تنظیم اولین اسلاید به عنوان اسلاید جاری
        first_slide = session.quiz.active_slides.first()

        session.status = 'active'
        session.current_slide = first_slide
        session.save()

        # TODO: ارسال WebSocket event برای شروع جلسه
        # websocket_manager.broadcast_to_session(session.code, {
        #     'type': 'SESSION_STARTED',
        #     'session_code': session.code,
        #     'current_slide': SlideSerializer(first_slide).data
        # })

        return Response({
            'status': 'جلسه شروع شد',
            'session_code': session.code,
            'current_slide': SlideSerializer(first_slide).data
        })

    @action(detail=True, methods=['post'], permission_classes=[CanStartQuizSession])
    def next_slide(self, request, quiz_id=None, pk=None):
        """حرکت به اسلاید بعدی"""
        from .serializers import SlideSerializer

        session = self.get_object()

        if session.status != 'active':
            return Response(
                {'error': 'جلسه فعال نیست'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ذخیره لیدربرد برای اسلاید فعلی قبل از حرکت
        if session.current_slide:
            # مدیریت پاسخ‌های داده نشده (علامت‌گذاری به عنوان غلط)
            handle_unanswered_questions(session, session.current_slide)

            # ذخیره اسنپ‌شات لیدربرد
            leaderboard_data = generate_leaderboard_data(session)
            LeaderboardSnapshot.objects.create(
                session=session,
                slide=session.current_slide,
                snapshot_data=leaderboard_data
            )

        # پیدا کردن اسلاید بعدی
        next_slide = get_next_slide(session)

        if not next_slide:
            # اگر اسلاید بعدی وجود ندارد، جلسه را پایان بده
            return self.end(request, quiz_id, pk)

        # به‌روزرسانی اسلاید جاری
        session.current_slide = next_slide
        session.save()

        # TODO: ارسال WebSocket event برای تغییر اسلاید
        # websocket_manager.broadcast_to_session(session.code, {
        #     'type': 'SLIDE_CHANGED',
        #     'slide': SlideSerializer(next_slide).data,
        #     'leaderboard': generate_leaderboard_data(session)
        # })

        return Response({
            'status': 'اسلاید تغییر کرد',
            'current_slide': SlideSerializer(next_slide).data,
            'leaderboard': generate_leaderboard_data(session)
        })

    @action(detail=True, methods=['post'], permission_classes=[CanStartQuizSession])
    def end(self, request, quiz_id=None, pk=None):
        """پایان جلسه"""
        session = self.get_object()

        if session.status == 'finished':
            return Response(
                {'error': 'جلسه قبلاً پایان یافته است'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ذخیره لیدربرد نهایی
        if session.current_slide:
            handle_unanswered_questions(session, session.current_slide)
            leaderboard_data = generate_leaderboard_data(session)
            LeaderboardSnapshot.objects.create(
                session=session,
                slide=session.current_slide,
                snapshot_data=leaderboard_data
            )

        session.status = 'finished'
        session.finished_at = timezone.now()
        session.save()

        # محاسبه آمار نهایی
        analytics_data = calculate_quiz_analytics(session)

        # TODO: ارسال WebSocket event برای پایان جلسه

        return Response({
            'status': 'جلسه پایان یافت',
            'analytics': analytics_data,
            'final_leaderboard': generate_leaderboard_data(session)
        })

    @action(detail=True, methods=['post'], permission_classes=[CanStartQuizSession])
    def pause(self, request, quiz_id=None, pk=None):
        """توقف موقت جلسه"""
        session = self.get_object()

        if session.status != 'active':
            return Response(
                {'error': 'فقط جلسات فعال قابل توقف هستند'},
                status=status.HTTP_400_BAD_REQUEST
            )

        session.status = 'paused'
        session.save()

        # TODO: ارسال WebSocket event برای توقف جلسه

        return Response({'status': 'جلسه متوقف شد'})

    @action(detail=True, methods=['post'], permission_classes=[CanStartQuizSession])
    def resume(self, request, quiz_id=None, pk=None):
        """ادامه جلسه"""
        session = self.get_object()

        if session.status != 'paused':
            return Response(
                {'error': 'جلسه در حالت توقف نیست'},
                status=status.HTTP_400_BAD_REQUEST
            )

        session.status = 'active'
        session.save()

        # TODO: ارسال WebSocket event برای ادامه جلسه

        return Response({'status': 'جلسه ادامه یافت'})


class ParticipantViewSet(viewsets.ModelViewSet):
    """ViewSet برای مدیریت شرکت‌کنندگان"""
    serializer_class = ParticipantSerializer
    permission_classes = [IsQuizOwnerOrManager]

    def get_queryset(self):
        """دریافت شرکت‌کنندگان کوییز"""
        quiz_id = self.kwargs.get('quiz_id')
        return Participant.objects.filter(quiz_id=quiz_id)

    @action(detail=False, methods=['post'], permission_classes=[])
    def join(self, request, quiz_id=None):
        """پیوستن به کوییز - بدون نیاز به احراز هویت"""
        from .serializers import ParticipantSerializer

        quiz = get_object_or_404(Quiz, id=quiz_id)

        # بررسی فعال بودن کوییز
        if not quiz.is_active:
            return Response(
                {'error': 'این کوییز غیرفعال است'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # پیدا کردن جلسه فعال
        active_session = QuizSession.objects.filter(
            quiz=quiz,
            status__in=['waiting', 'active']
        ).first()

        if not active_session:
            return Response(
                {'error': 'هیچ جلسه فعالی برای این کوییز وجود ندارد'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # اعتبارسنجی داده‌های ورودی
        serializer = JoinQuizSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # ایجاد شناسه یکتا برای شرکت‌کننده
        participant_session_id = str(uuid.uuid4())

        # ایجاد شرکت‌کننده
        participant_data = serializer.validated_data
        participant = Participant.objects.create(
            quiz=quiz,
            session_id=participant_session_id,
            full_name=participant_data['full_name'],
            avatar=participant_data['avatar'],
            device_info={
                'user_agent': request.META.get('HTTP_USER_AGENT', ''),
                'ip_address': self.get_client_ip(request)
            }
        )

        # افزایش شمارنده شرکت‌کنندگان
        active_session.participant_count += 1
        active_session.save()

        # TODO: ارسال WebSocket event برای پیوستن شرکت‌کننده

        return Response({
            'participant': ParticipantSerializer(participant).data,
            'session_code': active_session.code,
            'participant_token': participant_session_id  # برای احراز هویت درخواست‌های بعدی
        }, status=status.HTTP_201_CREATED)

    def get_client_ip(self, request):
        """دریافت IP کاربر"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class ParticipantAnswerViewSet(viewsets.ModelViewSet):
    """ViewSet برای مدیریت پاسخ‌ها"""
    serializer_class = ParticipantAnswerSerializer

    def get_queryset(self):
        """دریافت پاسخ‌های کوییز"""
        quiz_id = self.kwargs.get('quiz_id')
        return ParticipantAnswer.objects.filter(
            participant__quiz_id=quiz_id
        ).select_related('participant', 'slide', 'selected_option')

    def get_permissions(self):
        """تعیین permission بر اساس action"""
        if self.action == 'submit':
            return []  # بدون نیاز به احراز هویت برای ارسال پاسخ
        return [IsQuizOwnerOrManager()]

    @action(detail=False, methods=['post'], permission_classes=[])
    def submit(self, request, quiz_id=None):
        """ارسال پاسخ - بدون نیاز به احراز هویت"""
        from rest_framework import serializers

        # احراز هویت شرکت‌کننده بر اساس token
        participant_token = request.headers.get('X-Participant-Token')
        if not participant_token:
            return Response(
                {'error': 'توکن شرکت‌کننده الزامی است'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        try:
            participant = Participant.objects.get(
                session_id=participant_token, quiz_id=quiz_id)
        except Participant.DoesNotExist:
            return Response(
                {'error': 'شرکت‌کننده یافت نشد'},
                status=status.HTTP_404_NOT_FOUND
            )

        # پیدا کردن جلسه فعال
        active_session = QuizSession.objects.filter(
            quiz_id=quiz_id,
            status='active'
        ).first()

        if not active_session:
            return Response(
                {'error': 'هیچ جلسه فعالی وجود ندارد'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # بررسی اسلاید جاری
        current_slide = active_session.current_slide
        if not current_slide:
            return Response(
                {'error': 'هیچ سوال فعالی وجود ندارد'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # بررسی اینکه کاربر قبلاً پاسخ نداده باشد
        existing_answer = ParticipantAnswer.objects.filter(
            participant=participant,
            slide=current_slide,
            session=active_session
        ).exists()

        if existing_answer:
            return Response(
                {'error': 'شما قبلاً به این سوال پاسخ داده‌اید'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # اعتبارسنجی داده‌های پاسخ
        answer_serializer = SubmitAnswerSerializer(data=request.data)
        answer_serializer.is_valid(raise_exception=True)
        answer_data = answer_serializer.validated_data

        # بررسی زمان پاسخ (اگر از زمان مجاز گذشته باشد)
        # این منطق نیاز به پیاده‌سازی زمان‌سنج دارد

        # محاسبه صحیح/غلط
        is_correct = calculate_correctness(current_slide, answer_data)

        # محاسبه امتیاز
        points_earned = calculate_points(
            current_slide,
            is_correct,
            answer_data['response_time']
        )

        # ذخیره پاسخ
        with transaction.atomic():
            answer = ParticipantAnswer.objects.create(
                participant=participant,
                slide=current_slide,
                session=active_session,
                selected_option_id=answer_data.get('selected_option_id'),
                text_answer=answer_data.get('text_answer', ''),
                is_correct=is_correct,
                points_earned=points_earned,
                response_time=answer_data['response_time']
            )

            # به‌روزرسانی امتیاز شرکت‌کننده
            participant.total_score += points_earned
            if is_correct:
                participant.current_streak += 1
            else:
                participant.current_streak = 0
            participant.save()

        # TODO: ارسال WebSocket event برای ارسال پاسخ

        return Response({
            'status': 'پاسخ ثبت شد',
            'is_correct': is_correct,
            'points_earned': points_earned,
            'total_score': participant.total_score,
            'current_streak': participant.current_streak
        }, status=status.HTTP_201_CREATED)


class LeaderboardViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet برای مشاهده لیدربرد"""
    serializer_class = LeaderboardSnapshotSerializer
    permission_classes = [IsQuizOwnerOrManager]

    def get_queryset(self):
        """دریافت اسنپ‌شات‌های لیدربرد"""
        quiz_id = self.kwargs.get('quiz_id')
        return LeaderboardSnapshot.objects.filter(session__quiz_id=quiz_id).select_related('session', 'slide')

    @action(detail=False, methods=['get'], permission_classes=[IsQuizOwnerOrManager])
    def current(self, request, quiz_id=None):
        """لیدربرد فعلی"""
        # پیدا کردن جلسه فعال
        active_session = QuizSession.objects.filter(
            quiz_id=quiz_id,
            status='active'
        ).first()

        if not active_session:
            return Response(
                {'error': 'هیچ جلسه فعالی وجود ندارد'},
                status=status.HTTP_400_BAD_REQUEST
            )

        leaderboard_data = generate_leaderboard_data(active_session)
        return Response(leaderboard_data)


class AnalyticsViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet برای مشاهده آمار"""
    serializer_class = AnalyticsSerializer
    permission_classes = [CanViewAnalytics]

    def get_queryset(self):
        """دریافت آمار کوییز"""
        quiz_id = self.kwargs.get('quiz_id')
        return Analytics.objects.filter(quiz_id=quiz_id).select_related('quiz', 'slide')

    @action(detail=False, methods=['get'], permission_classes=[CanViewAnalytics])
    def summary(self, request, quiz_id=None):
        """خلاصه آمار کوییز"""
        quiz = get_object_or_404(Quiz, id=quiz_id)

        # محاسبه آمار کلی
        total_participants = quiz.participants.count()
        total_answers = ParticipantAnswer.objects.filter(
            participant__quiz=quiz).count()
        total_correct_answers = ParticipantAnswer.objects.filter(
            participant__quiz=quiz,
            is_correct=True
        ).count()

        # محاسبه میانگین امتیاز
        avg_score = quiz.participants.aggregate(
            avg_score=models.Avg('total_score'))['avg_score'] or 0

        # محاسبه نرخ دقت
        accuracy_rate = 0
        if total_answers > 0:
            accuracy_rate = round(
                (total_correct_answers / total_answers) * 100, 1)

        summary = {
            'total_participants': total_participants,
            'total_answers': total_answers,
            'total_correct_answers': total_correct_answers,
            'average_score': round(avg_score, 1),
            'accuracy_rate': accuracy_rate,
            'total_sessions': quiz.sessions.count(),
            'completion_rate': self.calculate_completion_rate(quiz)
        }

        return Response(summary)

    def calculate_completion_rate(self, quiz):
        """محاسبه نرخ تکمیل کوییز"""
        total_slides = quiz.slides.filter(is_active=True).count()
        if total_slides == 0:
            return 0

        # میانگین تعداد پاسخ‌های داده شده توسط شرکت‌کنندگان
        participant_count = quiz.participants.count()
        if participant_count == 0:
            return 0

        total_answers = ParticipantAnswer.objects.filter(
            participant__quiz=quiz).count()
        avg_answers = total_answers / participant_count

        completion_rate = (avg_answers / total_slides) * 100
        return round(min(completion_rate, 100), 1)

# View های مبتنی بر Function برای موارد خاص


class PublicQuizListView(generics.ListAPIView):
    """لیست کوییزهای عمومی"""
    serializer_class = QuizSerializer
    permission_classes = [DRFIsAuthenticated]

    def get_queryset(self):
        return Quiz.objects.filter(is_public=True, is_active=True)


class UserProfileView(generics.RetrieveAPIView):
    """پروفایل کاربر"""
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

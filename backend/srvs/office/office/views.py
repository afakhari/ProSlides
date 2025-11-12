from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import F, Max, Count
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from .models import Quiz, PickAnswerQuestion, Option, Participant, Answer
from .serializers import (
    QuizSerializer, QuizDetailSerializer, QuizUpdateSerializer,
    QuizWebSocketSerializer, PickAnswerQuestionSerializer,
    PickAnswerQuestionCreateSerializer, OptionSerializer,
    ParticipantSerializer, ParticipantCreateSerializer, AnswerSerializer
)
from .utils.order_manager import OrderManager
from .utils.points_calculator import PointsCalculator


class QuizViewSet(viewsets.ModelViewSet):
    serializer_class = QuizSerializer
    queryset = Quiz.objects.all().order_by('id')

    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return QuizUpdateSerializer
        return QuizSerializer

    def get_default_user(self):
        from django.contrib.auth.models import User
        user, created = User.objects.get_or_create(
            username='default_user',
            defaults={
                'email': 'default@quiz.com',
                'is_active': True,
                'is_staff': True,
                'is_superuser': True,
                'password': 'default_password'
            }
        )
        return user

    def create(self, request, *args, **kwargs):
        user = self.get_default_user()
        data = request.data.copy()
        if isinstance(data, dict):
            data['created_by'] = user.id

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        user = self.get_default_user()
        serializer.save(created_by=user)

    @swagger_auto_schema(
        method='get',
        operation_description="دریافت کامل اطلاعات کوئیز برای WebSocket",
        responses={
            200: QuizWebSocketSerializer,
            404: "کوئیز پیدا نشد"
        }
    )
    @action(detail=True, methods=['get'], url_path='ws-init')
    def ws_init(self, request, pk=None):
        """API برای دریافت کامل اطلاعات کوئیز جهت راه‌اندازی WebSocket"""
        quiz = self.get_object()

        # فعال کردن کوئیز برای شروع بازی
        quiz.is_active = True
        quiz.save()

        serializer = QuizWebSocketSerializer(quiz)
        return Response(serializer.data)

    @swagger_auto_schema(
        method='get',
        operation_description="دریافت کامل کوئیز با سوالات و گزینه‌ها",
        responses={
            200: QuizDetailSerializer,
            404: "کوئیز پیدا نشد"
        }
    )
    @action(detail=True, methods=['get'])
    def full_quiz(self, request, pk=None):
        quiz = self.get_object()
        serializer = QuizDetailSerializer(quiz)
        return Response(serializer.data)


class PickAnswerQuestionViewSet(viewsets.ModelViewSet):
    """
    مدیریت سوالات چندگزینه‌ای
    """

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PickAnswerQuestionCreateSerializer
        return PickAnswerQuestionSerializer

    def get_queryset(self):
        quiz_id = self.kwargs.get('quiz_pk')
        return PickAnswerQuestion.objects.filter(quiz_id=quiz_id).order_by('order')

    def get_serializer_context(self):
        """اضافه کردن quiz به context"""
        context = super().get_serializer_context()

        if getattr(self, 'swagger_fake_view', False):
            return context

        quiz_id = self.kwargs.get('quiz_pk')
        if quiz_id:
            try:
                context['quiz'] = get_object_or_404(Quiz, id=quiz_id)
            except:
                pass

        return context

    @swagger_auto_schema(
        operation_description="ایجاد سوال جدید در کوئیز",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['title', 'question_text', 'order'],
            properties={
                'title': openapi.Schema(type=openapi.TYPE_STRING, description='عنوان سوال'),
                'question_text': openapi.Schema(type=openapi.TYPE_STRING, description='متن سوال'),
                'order': openapi.Schema(type=openapi.TYPE_INTEGER, description='ترتیب سوال'),
                'time_limit': openapi.Schema(type=openapi.TYPE_INTEGER, description='زمان پاسخگویی'),
                'max_points': openapi.Schema(type=openapi.TYPE_INTEGER, description='حداکثر امتیاز'),
                'min_points': openapi.Schema(type=openapi.TYPE_INTEGER, description='حداقل امتیاز')
            }
        ),
        responses={
            201: PickAnswerQuestionSerializer,
            400: "داده‌های نامعتبر",
            404: "کوئیز پیدا نشد"
        }
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        quiz_id = self.kwargs.get('quiz_pk')
        quiz = get_object_or_404(Quiz, id=quiz_id)
        serializer.save(quiz=quiz)


class OptionViewSet(viewsets.ModelViewSet):
    """
    مدیریت گزینه‌های سوالات
    """
    serializer_class = OptionSerializer
    queryset = Option.objects.all().order_by('order', 'id')

    def get_queryset(self):
        question_id = self.kwargs.get('question_pk')
        return Option.objects.filter(question_id=question_id).order_by('order', 'id')

    @swagger_auto_schema(
        operation_description="ایجاد گزینه جدید برای سوال",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['text'],
            properties={
                'text': openapi.Schema(type=openapi.TYPE_STRING, description='متن گزینه'),
                'is_correct': openapi.Schema(type=openapi.TYPE_BOOLEAN, description='آیا گزینه صحیح است؟'),
                'order': openapi.Schema(type=openapi.TYPE_INTEGER, description='ترتیب گزینه'),
                'explanation': openapi.Schema(type=openapi.TYPE_STRING, description='توضیح گزینه')
            }
        ),
        responses={
            201: OptionSerializer,
            400: "داده‌های نامعتبر",
            404: "سوال پیدا نشد"
        }
    )
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @swagger_auto_schema(
        method='post',
        operation_description="جابجایی گزینه به بالا در ترتیب نمایش",
        responses={
            200: OptionSerializer,
            404: "گزینه پیدا نشد"
        }
    )
    @action(detail=True, methods=['post'])
    def move_up(self, request, quiz_pk=None, question_pk=None, pk=None):
        """جابجایی گزینه به بالا"""
        option = self.get_object()

        if option.order > 1:
            previous_option = Option.objects.filter(
                question=option.question,
                order=option.order - 1
            ).first()

            if previous_option:
                option.order, previous_option.order = previous_option.order, option.order
                option.save()
                previous_option.save()

        return Response(OptionSerializer(option).data)

    @swagger_auto_schema(
        method='post',
        operation_description="جابجایی گزینه به پایین در ترتیب نمایش",
        responses={
            200: OptionSerializer,
            404: "گزینه پیدا نشد"
        }
    )
    @action(detail=True, methods=['post'])
    def move_down(self, request, quiz_pk=None, question_pk=None, pk=None):
        """جابجایی گزینه به پایین"""
        option = self.get_object()
        max_order = Option.objects.filter(question=option.question).aggregate(
            Max('order')
        )['order__max']

        if option.order < max_order:
            next_option = Option.objects.filter(
                question=option.question,
                order=option.order + 1
            ).first()

            if next_option:
                option.order, next_option.order = next_option.order, option.order
                option.save()
                next_option.save()

        return Response(OptionSerializer(option).data)

    def perform_create(self, serializer):
        question_id = self.kwargs.get('question_pk')
        question = get_object_or_404(PickAnswerQuestion, id=question_id)

        data = serializer.validated_data

        if 'order' not in data or not data['order']:
            # استفاده از OrderManager
            last_order = OrderManager.get_next_order(
                Option.objects.filter(question=question))
            serializer.save(question=question, order=last_order)
        else:
            target_order = data['order']

            # بررسی تداخل ترتیب
            existing_option = Option.objects.filter(
                question=question,
                order=target_order
            ).first()

            if existing_option:
                # استفاده از OrderManager برای جابجایی بهینه
                OrderManager.shift_orders(
                    Option.objects.filter(question=question),
                    target_order,
                    1
                )

            serializer.save(question=question)

    def perform_update(self, serializer):
        """بهینه‌سازی آپدیت ترتیب"""
        instance = self.get_object()
        new_order = serializer.validated_data.get('order')

        if new_order and new_order != instance.order:
            question = instance.question
            old_order = instance.order

            # ابتدا به ترتیب موقت منتقل کن
            instance.order = 99999
            instance.save()

            # جابجایی بهینه
            if new_order > old_order:
                # کاهش ترتیب آیتم‌های بین old_order و new_order
                OrderManager.shift_orders(
                    Option.objects.filter(question=question),
                    old_order + 1,
                    -1
                )
            else:
                # افزایش ترتیب آیتم‌های بین new_order و old_order
                OrderManager.shift_orders(
                    Option.objects.filter(question=question),
                    new_order,
                    1
                )

            # حالا به ترتیب جدید منتقل کن
            instance.order = new_order
            instance.save()
        else:
            serializer.save()

    def _shift_options_from_order(self, question, target_order):
        queryset = Option.objects.filter(
            question=question,
            order__gte=target_order
        ).order_by('-order')

        for option in queryset:
            option.order += 1
            option.save()

    def _shift_options_between_orders(self, question, start_order, end_order, direction):
        if direction > 0:
            queryset = Option.objects.filter(
                question=question,
                order__gte=start_order,
                order__lte=end_order
            ).order_by('order')
            for option in queryset:
                option.order += 1
                option.save()
        else:
            queryset = Option.objects.filter(
                question=question,
                order__gte=start_order,
                order__lte=end_order
            ).order_by('-order')
            for option in queryset:
                option.order -= 1
                option.save()

    def perform_destroy(self, instance):
        """بهینه‌سازی حذف"""
        question = instance.question
        deleted_order = instance.order

        instance.delete()

        # کاهش ترتیب آیتم‌های بعدی
        OrderManager.shift_orders(
            Option.objects.filter(question=question),
            deleted_order + 1,
            -1
        )


class ParticipantViewSet(viewsets.ModelViewSet):
    """مدیریت شرکت‌کنندگان در کوئیز"""

    def get_serializer_class(self):
        if self.action == 'create':
            return ParticipantCreateSerializer
        return ParticipantSerializer

    def get_queryset(self):
        quiz_id = self.kwargs.get('quiz_pk')
        return Participant.objects.filter(quiz_id=quiz_id).order_by('joined_at')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        quiz_id = self.kwargs.get('quiz_pk')
        if quiz_id and not getattr(self, 'swagger_fake_view', False):
            context['quiz_id'] = quiz_id
        return context

    def perform_create(self, serializer):
        quiz_id = self.kwargs.get('quiz_pk')
        quiz = get_object_or_404(Quiz, id=quiz_id)
        serializer.save(quiz=quiz)


class AnswerViewSet(viewsets.ModelViewSet):
    serializer_class = AnswerSerializer
    queryset = Answer.objects.all().order_by('answered_at')

    def get_queryset(self):
        quiz_id = self.kwargs.get('quiz_pk')
        question_id = self.kwargs.get('question_pk')

        queryset = Answer.objects.filter(question__quiz_id=quiz_id)
        if question_id:
            queryset = queryset.filter(question_id=question_id)

        return queryset

    def create(self, request, *args, **kwargs):
        # بررسی وجود پاسخ تکراری
        question_id = self.kwargs.get('question_pk')
        participant_id = request.data.get('participant')

        if Answer.objects.filter(question_id=question_id, participant_id=participant_id).exists():
            return Response(
                {"error": "شما قبلاً به این سوال پاسخ داده‌اید"},
                status=status.HTTP_400_BAD_REQUEST
            )

        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        question_id = self.kwargs.get('question_pk')
        question = get_object_or_404(PickAnswerQuestion, id=question_id)
        quiz = question.quiz

        participant = serializer.validated_data['participant']
        selected_option = serializer.validated_data['selected_option']
        submit_time = serializer.validated_data['submit_time']

        # محاسبه امتیاز با PointsCalculator
        points = PointsCalculator.calculate(
            question=question,
            submit_time=submit_time,
            is_correct=selected_option.is_correct,
            calculation_method=quiz.points_calculation
        )

        serializer.save(question=question, points_earned=points)

        # به‌روزرسانی امتیاز کل
        participant.total_points += points
        participant.save()


class QuizStatsViewSet(viewsets.ViewSet):
    """آمار و گزارش‌های کوئیز"""

    @swagger_auto_schema(
        method='get',
        operation_description="دریافت آمار کلی کوئیز",
        responses={
            200: openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'participants_count': openapi.Schema(type=openapi.TYPE_INTEGER),
                    'questions_count': openapi.Schema(type=openapi.TYPE_INTEGER),
                    'total_answers': openapi.Schema(type=openapi.TYPE_INTEGER),
                }
            )
        }
    )
    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        """آمار کلی کوئیز"""
        quiz = get_object_or_404(Quiz, pk=pk)

        participants_count = quiz.participants.count()
        questions_count = quiz.slides.count()
        total_answers = Answer.objects.filter(question__quiz=quiz).count()

        return Response({
            'participants_count': participants_count,
            'questions_count': questions_count,
            'total_answers': total_answers,
        })

    @swagger_auto_schema(
        method='get',
        operation_description="دریافت آمار پاسخ‌های یک سوال",
        responses={
            200: openapi.Schema(
                type=openapi.TYPE_OBJECT,
                properties={
                    'question_title': openapi.Schema(type=openapi.TYPE_STRING),
                    'total_answers': openapi.Schema(type=openapi.TYPE_INTEGER),
                    'options_stats': openapi.Schema(
                        type=openapi.TYPE_ARRAY,
                        items=openapi.Items(
                            type=openapi.TYPE_OBJECT,
                            properties={
                                'option_id': openapi.Schema(type=openapi.TYPE_INTEGER),
                                'option_text': openapi.Schema(type=openapi.TYPE_STRING),
                                'count': openapi.Schema(type=openapi.TYPE_INTEGER),
                                'is_correct': openapi.Schema(type=openapi.TYPE_BOOLEAN),
                            }
                        )
                    )
                }
            )
        }
    )
    @action(detail=True, methods=['get'], url_path='question-stats/(?P<question_id>[^/.]+)')
    def question_stats(self, request, pk=None, question_id=None):
        """آمار پاسخ‌های یک سوال خاص"""
        quiz = get_object_or_404(Quiz, pk=pk)
        question = get_object_or_404(
            PickAnswerQuestion, id=question_id, quiz=quiz)

        options_stats = []
        for option in question.options.all():
            count = Answer.objects.filter(
                question=question, selected_option=option).count()
            options_stats.append({
                'option_id': option.id,
                'option_text': option.text,
                'count': count,
                'is_correct': option.is_correct,
            })

        return Response({
            'question_title': question.title,
            'total_answers': Answer.objects.filter(question=question).count(),
            'options_stats': options_stats,
        })

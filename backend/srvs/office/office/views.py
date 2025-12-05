import logging
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import F, Max
from django.contrib.auth import get_user_model
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from .models import Quiz, Slide, Question, Option, PlayerSession, Leaderboard
from .serializers import (
    QuizSerializer, SlideSerializer, QuestionSerializer, OptionSerializer,
    ExportSerializer, PlayerSessionSerializer, LeaderboardReceiveSerializer,
    RegisterSerializer
)
from .permissions import IsQuizOwner

User = get_user_model()

logger = logging.getLogger(__name__)


class QuizViewSet(viewsets.ModelViewSet):
    """
    مدیریت کوئیزها

    ایجاد، مشاهده، ویرایش و حذف کوئیزهای تعاملی
    """
    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # برای Swagger
        if getattr(self, 'swagger_fake_view', False):
            return Quiz.objects.none()
        return Quiz.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @swagger_auto_schema(
        operation_description="صادرات کامل اطلاعات کوئیز برای Rust",
        responses={200: ExportSerializer}
    )
    @action(detail=True, methods=['get'])
    def export(self, request, pk=None):
        """
        صادرات کامل کوئیز برای اجرا در Rust

        این endpoint تمام اطلاعات کوئیز شامل اسلایدها، سوالات و گزینه‌ها را 
        به فرمت مورد نیاز Rust برمی‌گرداند.
        """
        quiz = self.get_object()
        serializer = ExportSerializer(quiz)
        return Response(serializer.data)


class SlideViewSet(viewsets.ModelViewSet):
    """
    مدیریت اسلایدهای کوئیز

    هر کوئیز می‌تواند چندین اسلاید از نوع سوال یا محتوا داشته باشد.
    """
    serializer_class = SlideSerializer

    def get_queryset(self):
        # برای Swagger
        if getattr(self, 'swagger_fake_view', False):
            return Slide.objects.none()
        return Slide.objects.filter(quiz_id=self.kwargs['quiz_pk'], quiz__owner=self.request.user)

    def perform_create(self, serializer):
        quiz = get_object_or_404(Quiz, pk=self.kwargs['quiz_pk'], owner=self.request.user)
        order = serializer.validated_data.get('order')
        if order is not None and order < 1:
            raise ValidationError({'order': 'must be a positive integer'})

        with transaction.atomic():
            if order is not None:
                Slide.objects.filter(quiz=quiz, order__gte=order).update(order=F('order') + 1)
            serializer.save(quiz=quiz, order=order)

    def _reorder_existing(self, quiz, instance, new_order):
        """Shift other slides to keep order unique when one slide moves."""
        old_order = instance.order

        if new_order is None or new_order == old_order:
            return
        if new_order < 1:
            raise ValidationError({'order': 'must be a positive integer'})

        # Build new ordering in memory
        slides = list(Slide.objects.filter(quiz=quiz).order_by('order'))
        slides = [s for s in slides if s.pk != instance.pk]
        insert_pos = max(0, min(len(slides), new_order - 1))
        slides.insert(insert_pos, instance)

        # Temporarily shift all orders to avoid unique constraint clashes
        offset = (Slide.objects.filter(quiz=quiz).aggregate(max_order=Max('order'))['max_order'] or 0) + 1000
        Slide.objects.filter(quiz=quiz).update(order=F('order') + offset)

        # Apply final ordering
        for idx, slide in enumerate(slides, start=1):
            Slide.objects.filter(pk=slide.pk).update(order=idx)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        quiz = instance.quiz
        new_order = serializer.validated_data.get('order', instance.order)

        try:
            with transaction.atomic():
                self._reorder_existing(quiz, instance, new_order)
                serializer.save(quiz=quiz, order=new_order)
        except ValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            logger.exception(
                "Failed to update slide_id=%s quiz_id=%s", instance.id, quiz.id
            )
            return Response(
                {'error': 'Failed to update slide'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)


class QuestionViewSet(viewsets.ViewSet):
    """
    مدیریت سوالات اسلایدها

    هر اسلاید از نوع سوال می‌تواند یک سوال داشته باشد.
    """

    @swagger_auto_schema(
        operation_description="دریافت سوال یک اسلاید",
        responses={
            200: QuestionSerializer,
            404: openapi.Response("سوالی برای این اسلاید پیدا نشد")
        }
    )
    def retrieve(self, request, quiz_pk=None, slide_pk=None):
        """
        دریافت سوال مربوط به یک اسلاید
        """
        try:
            question = Question.objects.get(
                slide_id=slide_pk, slide__quiz_id=quiz_pk, slide__quiz__owner=request.user)
            serializer = QuestionSerializer(question)
            return Response(serializer.data)
        except Question.DoesNotExist:
            return Response(
                {'detail': 'No question found for this slide'},
                status=status.HTTP_404_NOT_FOUND
            )

    @swagger_auto_schema(
        operation_description="ایجاد سوال جدید برای اسلاید",
        request_body=QuestionSerializer,
        responses={
            201: QuestionSerializer,
            400: openapi.Response("اسلاید از قبل سوال دارد")
        }
    )
    def create(self, request, quiz_pk=None, slide_pk=None):
        """
        ایجاد سوال جدید برای یک اسلاید

        هر اسلاید فقط می‌تواند یک سوال داشته باشد.
        """
        slide = get_object_or_404(Slide, pk=slide_pk, quiz_id=quiz_pk, quiz__owner=request.user)

        with transaction.atomic():
            if Question.objects.filter(slide_id=slide_pk).exists():
                return Response(
                    {'error': 'This slide already has a question'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            serializer = QuestionSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            try:
                serializer.save(slide=slide)
            except Exception:
                logger.exception(
                    "Failed to create question for slide_id=%s quiz_pk=%s",
                    slide_pk, quiz_pk
                )
                return Response(
                    {'error': 'Failed to create question'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    @swagger_auto_schema(
        operation_description="آپدیت کامل سوال",
        request_body=QuestionSerializer,
        responses={
            200: QuestionSerializer,
            404: openapi.Response("سوالی برای این اسلاید پیدا نشد")
        }
    )
    def update(self, request, quiz_pk=None, slide_pk=None):
        """آپدیت کامل سوال برای یک اسلاید"""
        try:
            question = Question.objects.get(
                slide_id=slide_pk, slide__quiz_id=quiz_pk, slide__quiz__owner=request.user)
            serializer = QuestionSerializer(
                question, data=request.data, partial=False)
            serializer.is_valid(raise_exception=True)
            try:
                serializer.save()
            except Exception:
                logger.exception(
                    "Failed to update question slide_id=%s quiz_pk=%s",
                    slide_pk, quiz_pk
                )
                return Response(
                    {'error': 'Failed to update question'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            return Response(serializer.data)
        except Question.DoesNotExist:
            return Response(
                {'detail': 'No question found for this slide'},
                status=status.HTTP_404_NOT_FOUND
            )

    @swagger_auto_schema(
        operation_description="آپدیت جزئی سوال",
        request_body=QuestionSerializer,
        responses={
            200: QuestionSerializer,
            404: openapi.Response("سوالی برای این اسلاید پیدا نشد")
        }
    )
    def partial_update(self, request, quiz_pk=None, slide_pk=None):
        """آپدیت جزئی سوال برای یک اسلاید"""
        try:
            question = Question.objects.get(
                slide_id=slide_pk, slide__quiz_id=quiz_pk, slide__quiz__owner=request.user)
            serializer = QuestionSerializer(
                question, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            try:
                serializer.save()
            except Exception:
                logger.exception(
                    "Failed to partially update question slide_id=%s quiz_pk=%s",
                    slide_pk, quiz_pk
                )
                return Response(
                    {'error': 'Failed to update question'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            return Response(serializer.data)
        except Question.DoesNotExist:
            return Response(
                {'detail': 'No question found for this slide'},
                status=status.HTTP_404_NOT_FOUND
            )

    @swagger_auto_schema(
        operation_description="حذف سوال یک اسلاید",
        responses={
            204: "سوال با موفقیت حذف شد",
            404: openapi.Response("سوالی برای این اسلاید پیدا نشد")
        }
    )
    def destroy(self, request, quiz_pk=None, slide_pk=None):
        """حذف سوال برای یک اسلاید"""
        try:
            question = Question.objects.get(
                slide_id=slide_pk, slide__quiz_id=quiz_pk, slide__quiz__owner=request.user)
            question.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Question.DoesNotExist:
            return Response(
                {'detail': 'No question found for this slide'},
                status=status.HTTP_404_NOT_FOUND
            )


class OptionViewSet(viewsets.ModelViewSet):
    """
    مدیریت گزینه‌های سوالات

    هر سوال می‌تواند چندین گزینه داشته باشد.
    """
    serializer_class = OptionSerializer

    def get_queryset(self):
        # برای Swagger
        if getattr(self, 'swagger_fake_view', False):
            return Option.objects.none()

        question = get_object_or_404(
            Question,
            slide_id=self.kwargs['slide_pk'],
            slide__quiz_id=self.kwargs['quiz_pk'],
            slide__quiz__owner=self.request.user
        )
        return Option.objects.filter(question=question)

    def perform_create(self, serializer):
        question = get_object_or_404(
            Question,
            slide_id=self.kwargs['slide_pk'],
            slide__quiz_id=self.kwargs['quiz_pk']
        )
        try:
            serializer.save(question=question)
        except Exception:
            logger.exception(
                "Failed to create option for question slide_id=%s quiz_pk=%s",
                self.kwargs['slide_pk'], self.kwargs['quiz_pk']
            )
            raise


class ContentViewSet(viewsets.ViewSet):
    """
    مدیریت محتوای اسلایدها

    برای اسلایدهای نوع محتوا (slide_type=2)
    """

    @swagger_auto_schema(
        operation_description="دریافت محتوای اسلاید",
        responses={200: openapi.Response("محتوا دریافت شد")}
    )
    def retrieve(self, request, quiz_pk=None, slide_pk=None):
        """دریافت محتوای اسلاید"""
        slide = get_object_or_404(Slide, pk=slide_pk, quiz_id=quiz_pk, quiz__owner=request.user)
        return Response({
            'title': slide.title,
            'content_text': slide.content_text,
            'content_image_url': slide.content_image_url
        })

    @swagger_auto_schema(
        operation_description="آپدیت محتوای اسلاید",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                'title': openapi.Schema(type=openapi.TYPE_STRING),
                'content_text': openapi.Schema(type=openapi.TYPE_STRING),
                'content_image_url': openapi.Schema(type=openapi.TYPE_STRING),
            }
        ),
        responses={200: "محتوا با موفقیت آپدیت شد"}
    )
    def update(self, request, quiz_pk=None, slide_pk=None):
        """آپدیت محتوای اسلاید"""
        slide = get_object_or_404(Slide, pk=slide_pk, quiz_id=quiz_pk, quiz__owner=request.user)
        try:
            slide.title = request.data.get('title', slide.title)
            slide.content_text = request.data.get(
                'content_text', slide.content_text)
            slide.content_image_url = request.data.get(
                'content_image_url', slide.content_image_url)
            slide.save()
        except Exception:
            logger.exception(
                "Failed to update content slide_id=%s quiz_pk=%s", slide_pk, quiz_pk
            )
            return Response(
                {'error': 'Failed to update content'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({
            'title': slide.title,
            'content_text': slide.content_text,
            'content_image_url': slide.content_image_url
        })

    @swagger_auto_schema(
        operation_description="حذف محتوای اسلاید",
        responses={200: "محتوا با موفقیت حذف شد"}
    )
    def destroy(self, request, quiz_pk=None, slide_pk=None):
        """حذف محتوای اسلاید"""
        slide = get_object_or_404(Slide, pk=slide_pk, quiz_id=quiz_pk, quiz__owner=request.user)
        try:
            slide.title = None
            slide.content_text = None
            slide.content_image_url = None
            slide.save()
        except Exception:
            logger.exception(
                "Failed to delete content slide_id=%s quiz_pk=%s", slide_pk, quiz_pk
            )
            return Response(
                {'error': 'Failed to delete content'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        return Response({'status': 'content deleted'})


class PlayerSessionViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]
    """
    مدیریت سشن‌های بازیکنان

    ارتباط بین Rust WebSocket و Django برای شناسایی بازیکنان
    """
    queryset = PlayerSession.objects.all()
    serializer_class = PlayerSessionSerializer

    def get_queryset(self):
        # برای Swagger
        if getattr(self, 'swagger_fake_view', False):
            return PlayerSession.objects.none()
        return Quiz.objects.filter(owner=self.request.user)


class LeaderboardReceiveView(viewsets.ViewSet):
    permission_classes = [AllowAny]
    """
    دریافت لیدربرد از Rust
    """

    @swagger_auto_schema(
        operation_description="دریافت لیدربرد از Rust",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            required=['leaderboard'],
            properties={
                'leaderboard': openapi.Schema(
                    type=openapi.TYPE_ARRAY,
                    items=openapi.Schema(
                        type=openapi.TYPE_OBJECT,
                        properties={
                            'user_id': openapi.Schema(type=openapi.TYPE_STRING),
                            'score': openapi.Schema(type=openapi.TYPE_INTEGER),
                            'time_taken': openapi.Schema(type=openapi.TYPE_NUMBER),
                            'rank': openapi.Schema(type=openapi.TYPE_INTEGER),
                        }
                    )
                )
            }
        ),
        responses={200: "لیدربرد با موفقیت ذخیره شد"}
    )
    def create(self, request, quiz_pk=None, slide_pk=None):
        """دریافت لیدربرد از Rust"""
        serializer = LeaderboardReceiveSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # از روی slide_pk سوال مربوطه را پیدا می‌کنیم
        try:
            question = Question.objects.get(slide_id=slide_pk)
        except Question.DoesNotExist:
            return Response(
                {'error': 'No question found for this slide'},
                status=status.HTTP_404_NOT_FOUND
            )

        leaderboard_data = serializer.validated_data.get('leaderboard', [])
        if not leaderboard_data:
            return Response(
                {'error': 'leaderboard list is empty'},
                status=status.HTTP_400_BAD_REQUEST
            )

        saved_count = 0
        errors = []
        for entry in leaderboard_data:
            try:
                rust_id = entry.get('user_id')
                if not rust_id:
                    errors.append({'detail': 'user_id missing in entry'})
                    continue

                player_session = PlayerSession.objects.filter(
                    user_id=rust_id
                ).first()

                if player_session:
                    Leaderboard.objects.update_or_create(
                        question=question,
                        user_id=rust_id,
                        defaults={
                            'player_name': player_session.player_name,
                            'avatar': player_session.avatar,
                            'score': entry['score'],
                            'time_taken': entry['time_taken'],
                            'rank': entry['rank']
                        }
                    )
                    saved_count += 1
                else:
                    errors.append(
                        {
                            'user_id': rust_id,
                            'detail': 'player_session not found'
                        }
                    )
            except Exception:
                logger.exception(
                    "Failed to save leaderboard entry for question_id=%s", question.pk
                )
                errors.append(
                    {
                        'user_id': entry.get('user_id'),
                        'detail': 'internal error while saving entry'
                    }
                )

        response_data = {
            'status': 'leaderboard saved',
            'saved_entries': saved_count,
            'total_entries': len(leaderboard_data)
        }
        if errors:
            response_data['errors'] = errors
            return Response(response_data, status=status.HTTP_207_MULTI_STATUS)
        return Response(response_data)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


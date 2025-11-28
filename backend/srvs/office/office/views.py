from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from .models import Quiz, Slide, Question, Option, PlayerSession, Leaderboard
from .serializers import (
    QuizSerializer, SlideSerializer, QuestionSerializer, OptionSerializer,
    ExportSerializer, PlayerSessionSerializer
)


class QuizViewSet(viewsets.ModelViewSet):
    """
    مدیریت کوئیزها

    ایجاد، مشاهده، ویرایش و حذف کوئیزهای تعاملی
    """
    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer

    def get_queryset(self):
        # برای Swagger
        if getattr(self, 'swagger_fake_view', False):
            return Quiz.objects.none()
        return super().get_queryset()

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
        return Slide.objects.filter(quiz_id=self.kwargs['quiz_pk'])

    def perform_create(self, serializer):
        quiz = get_object_or_404(Quiz, pk=self.kwargs['quiz_pk'])
        order = self.request.data.get('order')
        serializer.save(quiz=quiz, order=order)


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
                slide_id=slide_pk, slide__quiz_id=quiz_pk)
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
        slide = get_object_or_404(Slide, pk=slide_pk, quiz_id=quiz_pk)

        with transaction.atomic():
            if Question.objects.filter(slide_id=slide_pk).exists():
                return Response(
                    {'error': 'This slide already has a question'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            serializer = QuestionSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(slide=slide)
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
                slide_id=slide_pk, slide__quiz_id=quiz_pk)
            serializer = QuestionSerializer(
                question, data=request.data, partial=False)
            serializer.is_valid(raise_exception=True)
            serializer.save()
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
                slide_id=slide_pk, slide__quiz_id=quiz_pk)
            serializer = QuestionSerializer(
                question, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
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
                slide_id=slide_pk, slide__quiz_id=quiz_pk)
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
            slide__quiz_id=self.kwargs['quiz_pk']
        )
        return Option.objects.filter(question=question)

    def perform_create(self, serializer):
        question = get_object_or_404(
            Question,
            slide_id=self.kwargs['slide_pk'],
            slide__quiz_id=self.kwargs['quiz_pk']
        )
        serializer.save(question=question)


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
        slide = get_object_or_404(Slide, pk=slide_pk, quiz_id=quiz_pk)
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
        slide = get_object_or_404(Slide, pk=slide_pk, quiz_id=quiz_pk)
        slide.title = request.data.get('title', slide.title)
        slide.content_text = request.data.get(
            'content_text', slide.content_text)
        slide.content_image_url = request.data.get(
            'content_image_url', slide.content_image_url)
        slide.save()

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
        slide = get_object_or_404(Slide, pk=slide_pk, quiz_id=quiz_pk)
        slide.title = None
        slide.content_text = None
        slide.content_image_url = None
        slide.save()
        return Response({'status': 'content deleted'})


class PlayerSessionViewSet(viewsets.ModelViewSet):
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
        return super().get_queryset()


class LeaderboardReceiveView(viewsets.ViewSet):
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
                            'rust_session_id': openapi.Schema(type=openapi.TYPE_STRING),
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
        # از روی slide_pk سوال مربوطه را پیدا می‌کنیم
        try:
            question = Question.objects.get(slide_id=slide_pk)
        except Question.DoesNotExist:
            return Response(
                {'error': 'No question found for this slide'},
                status=status.HTTP_404_NOT_FOUND
            )

        leaderboard_data = request.data.get('leaderboard', [])

        saved_count = 0
        for entry in leaderboard_data:
            player_session = PlayerSession.objects.filter(
                rust_session_id=entry['rust_session_id']
            ).first()

            if player_session:
                Leaderboard.objects.update_or_create(
                    question=question,
                    rust_session_id=entry['rust_session_id'],
                    defaults={
                        'player_name': player_session.player_name,
                        'avatar': player_session.avatar,
                        'score': entry['score'],
                        'time_taken': entry['time_taken'],
                        'rank': entry['rank']
                    }
                )
                saved_count += 1

        return Response({
            'status': 'leaderboard saved',
            'saved_entries': saved_count,
            'total_entries': len(leaderboard_data)
        })

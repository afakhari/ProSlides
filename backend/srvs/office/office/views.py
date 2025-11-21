from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db import transaction
from .models import Quiz, Slide, Question, Option, PlayerSession, Leaderboard
from .serializers import (
    QuizSerializer, SlideSerializer, QuestionSerializer, OptionSerializer,
    ExportSerializer, PlayerSessionSerializer, LeaderboardReceiveSerializer
)


class QuizViewSet(viewsets.ModelViewSet):
    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer

    @action(detail=True, methods=['get'])
    def export(self, request, pk=None):
        quiz = self.get_object()
        serializer = ExportSerializer(quiz)
        return Response(serializer.data)


class SlideViewSet(viewsets.ModelViewSet):
    serializer_class = SlideSerializer

    def get_queryset(self):
        return Slide.objects.filter(quiz_id=self.kwargs['quiz_pk'])

    def perform_create(self, serializer):
        quiz = get_object_or_404(Quiz, pk=self.kwargs['quiz_pk'])
        order = self.request.data.get('order')
        serializer.save(quiz=quiz, order=order)


class QuestionViewSet(viewsets.ViewSet):
    """
    ViewSet for managing questions for slides.
    """

    def retrieve(self, request, quiz_pk=None, slide_pk=None):
        """Get question for a slide"""
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

    def create(self, request, quiz_pk=None, slide_pk=None):
        """Create question for a slide"""
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

    def update(self, request, quiz_pk=None, slide_pk=None):
        """Update question for a slide"""
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

    def partial_update(self, request, quiz_pk=None, slide_pk=None):
        """Partial update question for a slide"""
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

    def destroy(self, request, quiz_pk=None, slide_pk=None):
        """Delete question for a slide"""
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
    serializer_class = OptionSerializer

    def get_queryset(self):
        # پیدا کردن سوال بر اساس slide_pk و quiz_pk
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
    def retrieve(self, request, quiz_pk=None, slide_pk=None):
        slide = get_object_or_404(Slide, pk=slide_pk, quiz_id=quiz_pk)
        return Response({
            'title': slide.title,
            'content_text': slide.content_text,
            'content_image': slide.content_image.url if slide.content_image else None
        })

    def update(self, request, quiz_pk=None, slide_pk=None):
        slide = get_object_or_404(Slide, pk=slide_pk, quiz_id=quiz_pk)
        slide.title = request.data.get('title', slide.title)
        slide.content_text = request.data.get(
            'content_text', slide.content_text)

        if 'content_image' in request.data:
            slide.content_image = request.data['content_image']

        slide.save()

        return Response({
            'title': slide.title,
            'content_text': slide.content_text,
            'content_image': slide.content_image.url if slide.content_image else None
        })

    def destroy(self, request, quiz_pk=None, slide_pk=None):
        slide = get_object_or_404(Slide, pk=slide_pk, quiz_id=quiz_pk)
        slide.title = None
        slide.content_text = None
        slide.content_image = None
        slide.save()
        return Response({'status': 'content deleted'})


class PlayerSessionViewSet(viewsets.ModelViewSet):
    queryset = PlayerSession.objects.all()
    serializer_class = PlayerSessionSerializer


class LeaderboardReceiveView(viewsets.ViewSet):
    def create(self, request, quiz_pk=None, slide_pk=None):
        # از Rust انتظار داریم question_id رو در body بفرستد
        question_id = request.data.get('question_id')

        if not question_id:
            return Response(
                {'error': 'question_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # بررسی اینکه question مربوط به slide و quiz مورد نظر باشد
        question = get_object_or_404(
            Question,
            pk=question_id,
            slide_id=slide_pk,
            slide__quiz_id=quiz_pk
        )

        leaderboard_data = request.data.get('leaderboard', [])

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

        return Response({'status': 'leaderboard saved'})

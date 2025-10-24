from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import Count, Sum
from .models import Quiz, Slide, Question, Option, Player, Leaderboard
from .serializers import (
    QuizSerializer, SlideSerializer, SlideCreateSerializer,
    QuestionSerializer, PlayerSerializer, PlayerCreateSerializer,
    LeaderboardSerializer
)


class QuizViewSet(viewsets.ModelViewSet):
    serializer_class = QuizSerializer

    def get_queryset(self):
        return Quiz.objects.filter(created_by=self.request.user)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class SlideViewSet(viewsets.ModelViewSet):
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return SlideCreateSerializer
        return SlideSerializer

    def get_queryset(self):
        quiz_id = self.kwargs.get('quiz_pk')
        return Slide.objects.filter(quiz_id=quiz_id)

    def perform_create(self, serializer):
        quiz_id = self.kwargs.get('quiz_pk')
        quiz = get_object_or_404(
            Quiz, id=quiz_id, created_by=self.request.user)
        serializer.save(quiz=quiz)

    @action(detail=True, methods=['post'])
    def add_question(self, request, quiz_pk=None, pk=None):
        slide = self.get_object()
        question_data = request.data

        # ایجاد یا آپدیت سوال
        if hasattr(slide, 'question'):
            question = slide.question
            question_serializer = QuestionSerializer(
                question, data=question_data, partial=True)
        else:
            question_serializer = QuestionSerializer(data=question_data)

        if question_serializer.is_valid():
            question = question_serializer.save(slide=slide)
            return Response(QuestionSerializer(question).data)
        return Response(question_serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class QuestionViewSet(viewsets.ModelViewSet):
    serializer_class = QuestionSerializer

    def get_queryset(self):
        slide_id = self.kwargs.get('slide_pk')
        return Question.objects.filter(slide_id=slide_id)

    def perform_create(self, serializer):
        slide_id = self.kwargs.get('slide_pk')
        slide = get_object_or_404(Slide, id=slide_id)
        serializer.save(slide=slide)


class PlayerViewSet(viewsets.ModelViewSet):
    def get_serializer_class(self):
        if self.action == 'create':
            return PlayerCreateSerializer
        return PlayerSerializer

    def get_queryset(self):
        quiz_id = self.kwargs.get('quiz_pk')
        return Player.objects.filter(quiz_id=quiz_id)

    def perform_create(self, serializer):
        quiz_id = self.kwargs.get('quiz_pk')
        quiz = get_object_or_404(Quiz, id=quiz_id)
        serializer.save(quiz=quiz)


class LeaderboardViewSet(viewsets.ModelViewSet):
    serializer_class = LeaderboardSerializer

    def get_queryset(self):
        quiz_id = self.kwargs.get('quiz_pk')
        slide_id = self.kwargs.get('slide_pk')

        if slide_id:
            # لیدربرد یک اسلاید خاص
            return Leaderboard.objects.filter(slide_id=slide_id)
        else:
            # لیدربرد کلی کوئیز (مجموع امتیازات)
            return Leaderboard.objects.filter(slide__quiz_id=quiz_id)

    @action(detail=False, methods=['get'])
    def overall(self, request, quiz_pk=None):
        """لیدربرد کلی کوئیز (مجموع امتیازات همه اسلایدها)"""
        players = Player.objects.filter(quiz_id=quiz_pk).annotate(
            total_score=Sum('leaderboard__score')
        ).order_by('-total_score')

        result = []
        for position, player in enumerate(players, 1):
            result.append({
                'position': position,
                'player_id': player.player_id,
                'player_name': player.name,
                'player_avatar': player.avatar,
                'total_score': player.total_score or 0
            })

        return Response(result)

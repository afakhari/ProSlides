from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Quiz, PickAnswerQuestion, Option
from .serializers import (
    QuizSerializer, QuizDetailSerializer,
    PickAnswerQuestionSerializer, PickAnswerQuestionCreateSerializer,
    OptionSerializer
)


class QuizViewSet(viewsets.ModelViewSet):
    serializer_class = QuizSerializer

    def get_queryset(self):
        return Quiz.objects.all()

    def perform_create(self, serializer):
        from django.contrib.auth.models import User
        user, created = User.objects.get_or_create(
            username='default_user',
            defaults={
                'email': 'default@quiz.com',
                'is_active': True,
                'is_staff': True,
                'is_superuser': True
            }
        )
        if created:
            user.set_password('default_password')
            user.save()
        serializer.save(created_by=user)

    @action(detail=True, methods=['get'])
    def full_quiz(self, request, pk=None):
        """API برای دریافت کامل کوئیز (مخصوص Rust)"""
        quiz = self.get_object()
        serializer = QuizDetailSerializer(quiz)
        return Response(serializer.data)


class PickAnswerQuestionViewSet(viewsets.ModelViewSet):
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PickAnswerQuestionCreateSerializer
        return PickAnswerQuestionSerializer

    def get_queryset(self):
        quiz_id = self.kwargs.get('quiz_pk')
        return PickAnswerQuestion.objects.filter(quiz_id=quiz_id)

    def perform_create(self, serializer):
        quiz_id = self.kwargs.get('quiz_pk')
        quiz = get_object_or_404(Quiz, id=quiz_id)
        serializer.save(quiz=quiz)

    @action(detail=True, methods=['post'])
    def add_option(self, request, quiz_pk=None, pk=None):
        """افزودن گزینه به سوال چندگزینه‌ای"""
        question = self.get_object()
        option_data = request.data

        option_serializer = OptionSerializer(data=option_data)
        if option_serializer.is_valid():
            option = option_serializer.save(question=question)
            return Response(OptionSerializer(option).data)
        return Response(option_serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class OptionViewSet(viewsets.ModelViewSet):
    serializer_class = OptionSerializer

    def get_queryset(self):
        question_id = self.kwargs.get('question_pk')
        return Option.objects.filter(question_id=question_id)

    def perform_create(self, serializer):
        question_id = self.kwargs.get('question_pk')
        question = get_object_or_404(PickAnswerQuestion, id=question_id)
        serializer.save(question=question)

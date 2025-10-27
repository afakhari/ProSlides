from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Quiz, Slide, Question, Option
from .serializers import (
    QuizSerializer, SlideSerializer, SlideCreateSerializer,
    QuestionSerializer
)


class QuizViewSet(viewsets.ModelViewSet):
    serializer_class = QuizSerializer
    queryset = Quiz.objects.all()

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
        quiz = get_object_or_404(Quiz, id=quiz_id)
        serializer.save(quiz=quiz)


class QuestionViewSet(viewsets.ModelViewSet):
    serializer_class = QuestionSerializer

    def get_queryset(self):
        slide_id = self.kwargs.get('slide_pk')
        return Question.objects.filter(slide_id=slide_id)

    def perform_create(self, serializer):
        slide_id = self.kwargs.get('slide_pk')
        slide = get_object_or_404(Slide, id=slide_id)
        serializer.save(slide=slide)

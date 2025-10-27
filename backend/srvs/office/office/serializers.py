from rest_framework import serializers
from .models import Quiz, Slide, Question, Option


class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ['id', 'text', 'is_correct']


class QuestionSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'text', 'options']


class SlideSerializer(serializers.ModelSerializer):
    question = QuestionSerializer(read_only=True)

    class Meta:
        model = Slide
        fields = ['id', 'quiz', 'title', 'order', 'question_type', 'question']


class SlideCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Slide
        fields = ['id', 'title', 'order', 'question_type']


class QuizSerializer(serializers.ModelSerializer):
    slides = SlideSerializer(many=True, read_only=True)

    class Meta:
        model = Quiz
        fields = ['id', 'title', 'created_by', 'created_at', 'slides']

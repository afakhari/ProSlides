# serializers.py
from rest_framework import serializers
from django.core.exceptions import ValidationError
from .models import Quiz, PickAnswerQuestion, Option, Participant, Answer


class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ['id', 'text', 'is_correct', 'order', 'explanation']

    def validate_order(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Order must be greater than zero.")
        return value


class PickAnswerQuestionSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True, read_only=True)
    actual_time_limit = serializers.SerializerMethodField()

    class Meta:
        model = PickAnswerQuestion
        fields = ['id', 'quiz', 'title', 'order', 'question_text',
                  'time_limit', 'max_points', 'min_points', 'actual_time_limit', 'options']

    def get_actual_time_limit(self, obj):
        return obj.get_actual_time_limit()

    def validate_order(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Order must be greater than zero.")
        return value


class PickAnswerQuestionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PickAnswerQuestion
        fields = ['id', 'title', 'order', 'question_text',
                  'time_limit', 'max_points', 'min_points']

    def validate_order(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Order must be greater than zero.")
        return value

    def validate(self, data):
        quiz = self.context.get('quiz')
        order = data.get('order')

        if quiz and order:
            existing = PickAnswerQuestion.objects.filter(
                quiz=quiz, order=order)
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise serializers.ValidationError({
                    'order': f'A question with order {order} already exists in this quiz.'
                })
        return data


# سریالایزرهای مخصوص WebSocket مطابق format.json
class OptionWebSocketSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ['id', 'text', 'order']


class QuestionWebSocketSerializer(serializers.ModelSerializer):
    options = OptionWebSocketSerializer(many=True, read_only=True)
    question_time = serializers.SerializerMethodField()

    class Meta:
        model = PickAnswerQuestion
        fields = ['id', 'title', 'order', 'question_text',
                  'question_time', 'max_points', 'min_points', 'options']

    def get_question_time(self, obj):
        return obj.get_actual_time_limit()


class ParticipantWebSocketSerializer(serializers.ModelSerializer):
    class Meta:
        model = Participant
        fields = ['user_id', 'name', 'avatar',
                  'is_host', 'total_points', 'joined_at']


class QuizWebSocketSerializer(serializers.ModelSerializer):
    questions = QuestionWebSocketSerializer(many=True, read_only=True)
    players = serializers.SerializerMethodField()
    game_settings = serializers.SerializerMethodField()
    total_questions = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = ['id', 'title', 'session_id', 'total_questions',
                  'questions', 'players', 'game_settings']

    def get_players(self, obj):
        participants = Participant.objects.filter(quiz=obj)
        return ParticipantWebSocketSerializer(participants, many=True).data

    def get_game_settings(self, obj):
        return obj.get_game_settings()

    def get_total_questions(self, obj):
        return obj.slides.count()


class QuizDetailSerializer(serializers.ModelSerializer):
    slides = serializers.SerializerMethodField()
    default_time_per_question = serializers.IntegerField()

    class Meta:
        model = Quiz
        fields = ['id', 'title', 'created_by', 'created_at',
                  'default_time_per_question', 'points_calculation',
                  'allow_retries', 'slides']

    def get_slides(self, obj):
        questions = PickAnswerQuestion.objects.filter(
            quiz=obj).order_by('order')
        return PickAnswerQuestionSerializer(questions, many=True).data


class QuizSerializer(serializers.ModelSerializer):
    slides_count = serializers.IntegerField(
        source='slides.count', read_only=True)
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    default_time_per_question = serializers.IntegerField()

    class Meta:
        model = Quiz
        fields = ['id', 'title', 'created_by', 'created_at',
                  'default_time_per_question', 'points_calculation',
                  'allow_retries', 'slides_count']
        read_only_fields = ['created_by', 'created_at']


class QuizUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quiz
        fields = ['id', 'title', 'default_time_per_question',
                  'points_calculation', 'allow_retries']


class ParticipantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Participant
        fields = ['id', 'name', 'avatar', 'joined_at', 'session_id',
                  'user_id', 'is_host', 'total_points']
        read_only_fields = ['joined_at', 'session_id', 'user_id']


class ParticipantCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Participant
        fields = ['name', 'avatar']

    def validate(self, data):
        quiz_id = self.context.get('quiz_id')
        name = data.get('name')

        if quiz_id and name:
            if Participant.objects.filter(quiz_id=quiz_id, name=name).exists():
                raise serializers.ValidationError({
                    'name': 'این نام در این کوئیز قبلاً استفاده شده است.'
                })
        return data


class AnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Answer
        fields = ['id', 'participant', 'question', 'selected_option',
                  'answered_at', 'submit_time', 'points_earned']
        read_only_fields = ['answered_at']

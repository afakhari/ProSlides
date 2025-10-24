from rest_framework import serializers
from .models import Quiz, Slide, Question, Option, Player, Leaderboard


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
    slides_count = serializers.IntegerField(
        source='slides.count', read_only=True)

    class Meta:
        model = Quiz
        fields = ['id', 'title', 'created_by',
                  'created_at', 'slides', 'slides_count']


class PlayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = ['id', 'quiz', 'player_id', 'name',
                  'avatar', 'total_score', 'joined_at']


class PlayerCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = ['player_id', 'name', 'avatar']


class LeaderboardSerializer(serializers.ModelSerializer):
    player_name = serializers.CharField(source='player.name', read_only=True)
    player_avatar = serializers.CharField(
        source='player.avatar', read_only=True)

    class Meta:
        model = Leaderboard
        fields = ['id', 'slide', 'player', 'player_name',
                  'player_avatar', 'score', 'position']

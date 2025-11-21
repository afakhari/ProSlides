from rest_framework import serializers
from .models import Quiz, Slide, Question, Option, PlayerSession, Leaderboard


class OptionSerializer(serializers.ModelSerializer):
    option_id = serializers.IntegerField(source='id', read_only=True)

    class Meta:
        model = Option
        fields = ['option_id', 'text', 'is_correct', 'votes', 'image_url']
        read_only_fields = ['option_id', 'votes']


class QuestionSerializer(serializers.ModelSerializer):
    question_id = serializers.IntegerField(source='id', read_only=True)
    options = OptionSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = [
            'question_id', 'title', 'text', 'question_type', 'min_point',
            'max_point', 'time_limit', 'image_url', 'faster_answers_more_points',
            'partial_scoring', 'options'
        ]
        read_only_fields = ['question_id']


class SlideSerializer(serializers.ModelSerializer):
    slide_id = serializers.IntegerField(source='id', read_only=True)
    question = QuestionSerializer(read_only=True)

    class Meta:
        model = Slide
        fields = [
            'slide_id', 'slide_type', 'order', 'show_leaderboard_after',
            'title', 'content_text', 'content_image_url', 'question'
        ]
        read_only_fields = ['slide_id']
        extra_kwargs = {
            'order': {'required': False},
            'title': {'required': False},
            'content_text': {'required': False}
        }


class QuizSerializer(serializers.ModelSerializer):
    quiz_id = serializers.IntegerField(source='id', read_only=True)
    slides = SlideSerializer(many=True, read_only=True)

    class Meta:
        model = Quiz
        fields = [
            'quiz_id', 'title', 'created_at', 'author', 'music_url',
            'background_color', 'background_image_url', 'slides'
        ]
        read_only_fields = ['quiz_id', 'created_at']


class ExportSerializer(serializers.ModelSerializer):
    quiz_id = serializers.IntegerField(source='id', read_only=True)
    slides = SlideSerializer(many=True, read_only=True)
    background = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = ['quiz_id', 'title', 'background', 'music_url', 'slides']

    def get_background(self, obj):
        return {
            'color': obj.background_color,
            'image': obj.background_image_url
        }


class PlayerSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlayerSession
        fields = ['rust_session_id', 'quiz', 'player_name', 'avatar']


class LeaderboardEntrySerializer(serializers.Serializer):
    rust_session_id = serializers.CharField()
    score = serializers.IntegerField()
    time_taken = serializers.FloatField()
    rank = serializers.IntegerField()


class LeaderboardReceiveSerializer(serializers.Serializer):
    leaderboard = LeaderboardEntrySerializer(many=True)

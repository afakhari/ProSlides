from rest_framework import serializers
from .models import Quiz, Slide, Question, Option, PlayerSession, Leaderboard


class OptionSerializer(serializers.ModelSerializer):
    option_id = serializers.IntegerField(source='id', read_only=True)

    class Meta:
        model = Option
        fields = ['option_id', 'text', 'is_correct', 'votes', 'image_url']
        read_only_fields = ['option_id', 'votes']

    def create(self, validated_data):
        """
        ایجاد گزینه جدید برای یک سوال
        """
        return super().create(validated_data)


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
    leaderboard = serializers.SerializerMethodField()  # اضافه شده اینجا

    class Meta:
        model = Slide
        fields = [
            'slide_id', 'slide_type', 'order', 'show_leaderboard_after',
            'title', 'content_text', 'content_image_url', 'question', 'leaderboard'
        ]
        read_only_fields = ['slide_id']
        extra_kwargs = {
            'order': {'required': False},
            'title': {'required': False},
            'content_text': {'required': False}
        }

    def get_leaderboard(self, obj):
        """دریافت لیدربرد برای اسلایدهای سوال"""
        if obj.slide_type == 1 and hasattr(obj, 'question'):  # فقط برای اسلایدهای سوال
            try:
                leaderboard_entries = Leaderboard.objects.filter(
                    question=obj.question).order_by('rank')
                serializer = LeaderboardEntrySerializer(
                    leaderboard_entries, many=True)
                return serializer.data
            except Exception as e:
                print(f"Error in get_leaderboard: {e}")
                return []
        return []


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


class LeaderboardEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Leaderboard
        fields = ['rust_session_id', 'player_name',
                  'avatar', 'score', 'time_taken', 'rank']
        read_only_fields = ['rust_session_id', 'player_name',
                            'avatar', 'score', 'time_taken', 'rank']


class LeaderboardReceiveSerializer(serializers.Serializer):
    leaderboard = LeaderboardEntrySerializer(many=True)

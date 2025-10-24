from rest_framework import serializers
from .models import (
    Quiz, QuizManager, Slide, SlideOption,
    QuizSession, Participant, ParticipantAnswer,
    LeaderboardSnapshot, Analytics
)


class SlideOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SlideOption
        fields = ['id', 'text', 'image', 'is_correct', 'order']


class SlideSerializer(serializers.ModelSerializer):
    options = SlideOptionSerializer(many=True, read_only=True)

    class Meta:
        model = Slide
        fields = [
            'id', 'title', 'content', 'slide_type', 'order',
            'time_limit', 'points', 'image', 'is_active', 'options'
        ]


class QuizSerializer(serializers.ModelSerializer):
    slides = SlideSerializer(many=True, read_only=True)
    owner_name = serializers.CharField(source='owner.username', read_only=True)

    class Meta:
        model = Quiz
        fields = [
            'id', 'title', 'description', 'code', 'owner', 'owner_name',
            'is_active', 'is_public', 'settings', 'created_at', 'updated_at', 'slides'
        ]
        read_only_fields = ['code', 'owner', 'created_at', 'updated_at']


class QuizManagerSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = QuizManager
        fields = [
            'id', 'user', 'user_name', 'user_email', 'permission_level',
            'can_start_session', 'can_edit_questions', 'can_view_analytics', 'added_at'
        ]


class QuizSessionSerializer(serializers.ModelSerializer):
    quiz_title = serializers.CharField(source='quiz.title', read_only=True)
    started_by_name = serializers.CharField(
        source='started_by.username', read_only=True)

    class Meta:
        model = QuizSession
        fields = [
            'id', 'code', 'quiz', 'quiz_title', 'current_slide', 'status',
            'started_by', 'started_by_name', 'started_at', 'finished_at', 'participant_count'
        ]
        read_only_fields = ['code', 'started_at',
                            'finished_at', 'participant_count']


class ParticipantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Participant
        fields = [
            'id', 'quiz', 'session_id', 'full_name', 'avatar',
            'total_score', 'current_streak', 'joined_at', 'last_active'
        ]
        read_only_fields = ['id', 'session_id', 'total_score',
                            'current_streak', 'joined_at', 'last_active']


class ParticipantAnswerSerializer(serializers.ModelSerializer):
    participant_name = serializers.CharField(
        source='participant.full_name', read_only=True)
    slide_title = serializers.CharField(source='slide.title', read_only=True)

    class Meta:
        model = ParticipantAnswer
        fields = [
            'id', 'participant', 'participant_name', 'slide', 'slide_title',
            'session', 'selected_option', 'text_answer', 'is_correct',
            'points_earned', 'response_time', 'answered_at'
        ]
        read_only_fields = ['is_correct', 'points_earned', 'answered_at']


class LeaderboardSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaderboardSnapshot
        fields = ['id', 'session', 'slide', 'snapshot_data', 'created_at']


class AnalyticsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Analytics
        fields = ['id', 'quiz', 'slide', 'total_participants',
                  'correct_answers', 'average_time', 'created_at']

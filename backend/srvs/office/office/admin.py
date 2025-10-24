from django.contrib import admin
from .models import (
    Quiz, QuizManager, Slide, SlideOption,
    QuizSession, Participant, ParticipantAnswer,
    LeaderboardSnapshot, Analytics
)


@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ['title', 'code', 'owner',
                    'is_active', 'is_public', 'created_at']
    list_filter = ['is_active', 'is_public', 'created_at']
    search_fields = ['title', 'code', 'owner__username']
    readonly_fields = ['code', 'created_at', 'updated_at']


@admin.register(QuizManager)
class QuizManagerAdmin(admin.ModelAdmin):
    list_display = ['quiz', 'user', 'permission_level',
                    'can_start_session', 'added_at']
    list_filter = ['permission_level', 'can_start_session']
    search_fields = ['quiz__title', 'user__username']


@admin.register(Slide)
class SlideAdmin(admin.ModelAdmin):
    list_display = ['title', 'quiz', 'slide_type',
                    'order', 'time_limit', 'is_active']
    list_filter = ['slide_type', 'is_active']
    search_fields = ['title', 'quiz__title']


@admin.register(SlideOption)
class SlideOptionAdmin(admin.ModelAdmin):
    list_display = ['text', 'slide', 'is_correct', 'order']
    list_filter = ['is_correct']
    search_fields = ['text', 'slide__title']


@admin.register(QuizSession)
class QuizSessionAdmin(admin.ModelAdmin):
    list_display = ['quiz', 'code', 'status',
                    'started_by', 'started_at', 'participant_count']
    list_filter = ['status', 'started_at']
    search_fields = ['quiz__title', 'code']


@admin.register(Participant)
class ParticipantAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'quiz',
                    'total_score', 'current_streak', 'joined_at']
    search_fields = ['full_name', 'quiz__title']
    readonly_fields = ['joined_at', 'last_active']


@admin.register(ParticipantAnswer)
class ParticipantAnswerAdmin(admin.ModelAdmin):
    list_display = ['participant', 'slide',
                    'is_correct', 'points_earned', 'answered_at']
    list_filter = ['is_correct', 'answered_at']
    search_fields = ['participant__full_name', 'slide__title']


@admin.register(LeaderboardSnapshot)
class LeaderboardSnapshotAdmin(admin.ModelAdmin):
    list_display = ['session', 'slide', 'created_at']
    readonly_fields = ['created_at']


@admin.register(Analytics)
class AnalyticsAdmin(admin.ModelAdmin):
    list_display = ['quiz', 'slide', 'total_participants',
                    'correct_answers', 'created_at']
    readonly_fields = ['created_at']

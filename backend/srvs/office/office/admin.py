from django.contrib import admin
from .models import Quiz, Slide, Question, Option, PlayerSession, Leaderboard


@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ['title', 'author', 'created_at']
    list_filter = ['created_at', 'author']


@admin.register(Slide)
class SlideAdmin(admin.ModelAdmin):
    list_display = ['quiz', 'slide_type', 'order', 'show_leaderboard_after']
    list_filter = ['slide_type', 'show_leaderboard_after']


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ['title', 'question_type', 'time_limit', 'max_point']
    list_filter = ['question_type']


@admin.register(Option)
class OptionAdmin(admin.ModelAdmin):
    list_display = ['text', 'question', 'is_correct', 'votes']
    list_filter = ['is_correct']


@admin.register(PlayerSession)
class PlayerSessionAdmin(admin.ModelAdmin):
    list_display = ['player_name', 'quiz', 'rust_session_id', 'created_at']
    list_filter = ['quiz', 'created_at']


@admin.register(Leaderboard)
class LeaderboardAdmin(admin.ModelAdmin):
    list_display = ['player_name', 'question', 'score', 'rank', 'created_at']
    list_filter = ['question', 'created_at']

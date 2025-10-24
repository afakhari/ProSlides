# permissions.py
from rest_framework import permissions
from .models import Quiz, QuizManager


class IsQuizOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.owner == request.user


class CanStartQuizSession(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        quiz_id = view.kwargs.get('quiz_id')
        if quiz_id:
            try:
                quiz = Quiz.objects.get(id=quiz_id)
                if quiz.owner == request.user:
                    return True
                manager = QuizManager.objects.filter(
                    quiz=quiz, user=request.user).first()
                return manager and manager.can_start_session
            except Quiz.DoesNotExist:
                return False
        return False


class IsQuizOwnerOrManager(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        quiz_id = view.kwargs.get('quiz_id')
        if quiz_id:
            try:
                quiz = Quiz.objects.get(id=quiz_id)
                if quiz.owner == request.user:
                    return True
                return QuizManager.objects.filter(quiz=quiz, user=request.user).exists()
            except Quiz.DoesNotExist:
                return False
        return False


class CanEditQuiz(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        quiz_id = view.kwargs.get('quiz_id')
        if quiz_id:
            try:
                quiz = Quiz.objects.get(id=quiz_id)
                if quiz.owner == request.user:
                    return True
                manager = QuizManager.objects.filter(
                    quiz=quiz, user=request.user).first()
                return manager and manager.permission_level in ['edit', 'full']
            except Quiz.DoesNotExist:
                return False
        return False

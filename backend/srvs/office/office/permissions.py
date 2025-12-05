from rest_framework.permissions import BasePermission


class IsQuizOwner(BasePermission):
    """
    اجازه دسترسی تنها برای مالک کوییز.
    """

    def has_object_permission(self, request, view, obj):
        quiz = getattr(obj, "quiz", None) or obj
        owner = getattr(quiz, "owner", None)
        return owner is not None and owner == request.user

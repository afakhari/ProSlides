import secrets

from django.conf import settings
from rest_framework.permissions import BasePermission


def _is_service_token_valid(request):
    token = request.headers.get("X-Export-Token", "")
    service_token = getattr(settings, "EXPORT_SERVICE_TOKEN", "")
    if not token or not service_token:
        return False
    return secrets.compare_digest(token, service_token)


class IsQuizOwner(BasePermission):
    """
    اجازه دسترسی تنها برای مالک کوییز.
    """

    def has_object_permission(self, request, view, obj):
        quiz = getattr(obj, "quiz", None) or obj
        owner = getattr(quiz, "owner", None)
        return owner is not None and owner == request.user


class IsExportServiceOrQuizOwner(BasePermission):
    """
    Allow access if the request carries a valid export service token or the
    authenticated user owns the quiz.
    """

    message = "Export requires authentication or a valid service token."

    def has_permission(self, request, view):
        if _is_service_token_valid(request):
            request._export_service_token_valid = True
            return True
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if getattr(request, "_export_service_token_valid", False):
            return True
        quiz = getattr(obj, "quiz", None) or obj
        owner = getattr(quiz, "owner", None)
        return owner is not None and owner == request.user


class IsServiceToken(BasePermission):
    message = "This endpoint requires a valid service token."

    def has_permission(self, request, view):
        return _is_service_token_valid(request)

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'quizzes', views.QuizViewSet, basename='quiz')

urlpatterns = [
    path('api/', include(router.urls)),

    # سوالات چندگزینه‌ای
    path('api/quizzes/<int:quiz_pk>/questions/', views.PickAnswerQuestionViewSet.as_view({
        'get': 'list',
        'post': 'create'
    }), name='quiz-questions'),

    path('api/quizzes/<int:quiz_pk>/questions/<int:pk>/', views.PickAnswerQuestionViewSet.as_view({
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy'
    }), name='quiz-question-detail'),

    # گزینه‌ها
    path('api/quizzes/<int:quiz_pk>/questions/<int:question_pk>/options/', views.OptionViewSet.as_view({
        'get': 'list',
        'post': 'create'
    }), name='question-options'),

    path('api/quizzes/<int:quiz_pk>/questions/<int:question_pk>/options/<int:pk>/', views.OptionViewSet.as_view({
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy'
    }), name='question-option-detail'),
]

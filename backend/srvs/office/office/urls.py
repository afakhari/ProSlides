from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'quizzes', views.QuizViewSet, basename='quiz')

urlpatterns = [
    path('api/', include(router.urls)),

    path('api/quizzes/<int:quiz_pk>/slides/', views.SlideViewSet.as_view({
        'get': 'list',
        'post': 'create'
    }), name='quiz-slides'),

    path('api/quizzes/<int:quiz_pk>/slides/<int:pk>/', views.SlideViewSet.as_view({
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy'
    }), name='quiz-slide-detail'),

    path('api/quizzes/<int:quiz_pk>/slides/<int:slide_pk>/questions/', views.QuestionViewSet.as_view({
        'get': 'list',
        'post': 'create'
    }), name='slide-questions'),

    path('api/quizzes/<int:quiz_pk>/slides/<int:slide_pk>/questions/<int:pk>/', views.QuestionViewSet.as_view({
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy'
    }), name='slide-question-detail'),
]

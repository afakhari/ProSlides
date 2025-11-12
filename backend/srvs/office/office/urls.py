from django.urls import path, include, re_path
from django.contrib import admin
from rest_framework import permissions
from rest_framework.routers import DefaultRouter
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from . import views

schema_view = get_schema_view(
    openapi.Info(
        title="ProSlides API",
        default_version='v1',
        description="""
        API documentation for ProSlides - A Quiz Platform

        ## Features:
        - Complete CRUD for Quizzes, Questions, and Options
        - Order management for options
        - Participant management
        - Answer submission
        - Ready for Rust WebSocket integration

        ## Authentication:
        Currently disabled for development. All endpoints are publicly accessible.
        """,
        terms_of_service="https://www.google.com/policies/terms/",
        contact=openapi.Contact(email="contact@proslides.local"),
        license=openapi.License(name="BSD License"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

router = DefaultRouter()
router.register(r'quizzes', views.QuizViewSet, basename='quiz')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),

    # Quiz actions
    path('api/quizzes/<int:pk>/full_quiz/',
         views.QuizViewSet.as_view({'get': 'full_quiz'}), name='quiz-full'),

    path('api/quizzes/<int:pk>/ws-init/',
         views.QuizViewSet.as_view({'get': 'ws_init'}), name='quiz-ws-init'),

    # Questions endpoints
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

    # Options endpoints
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

    # Option actions
    path('api/quizzes/<int:quiz_pk>/questions/<int:question_pk>/options/<int:pk>/move_up/',
         views.OptionViewSet.as_view({'post': 'move_up'}), name='option-move-up'),

    path('api/quizzes/<int:quiz_pk>/questions/<int:question_pk>/options/<int:pk>/move_down/',
         views.OptionViewSet.as_view({'post': 'move_down'}), name='option-move-down'),

    path('api/quizzes/<int:quiz_pk>/questions/<int:question_pk>/options/reorder/',
         views.OptionViewSet.as_view({'post': 'reorder'}), name='option-reorder'),

    # Participants endpoints
    path('api/quizzes/<int:quiz_pk>/participants/', views.ParticipantViewSet.as_view({
        'get': 'list',
        'post': 'create'
    }), name='quiz-participants'),

    path('api/quizzes/<int:quiz_pk>/participants/<int:pk>/', views.ParticipantViewSet.as_view({
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy'
    }), name='quiz-participant-detail'),

    # Answers endpoints
    path('api/quizzes/<int:quiz_pk>/questions/<int:question_pk>/answers/', views.AnswerViewSet.as_view({
        'get': 'list',
        'post': 'create'
    }), name='question-answers'),

    path('api/quizzes/<int:quiz_pk>/questions/<int:question_pk>/answers/<int:pk>/', views.AnswerViewSet.as_view({
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy'
    }), name='question-answer-detail'),

    # Quiz stats endpoints
    path('api/quizzes/<int:pk>/stats/',
         views.QuizStatsViewSet.as_view({'get': 'stats'}), name='quiz-stats'),

    path('api/quizzes/<int:pk>/question-stats/<int:question_id>/',
         views.QuizStatsViewSet.as_view({'get': 'question_stats'}), name='quiz-question-stats'),

    # Swagger documentation
    re_path(r'^swagger(?P<format>\.json|\.yaml)$',
            schema_view.without_ui(cache_timeout=0), name='schema-json'),
    path('swagger/', schema_view.with_ui('swagger',
         cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc',
         cache_timeout=0), name='schema-redoc'),
]

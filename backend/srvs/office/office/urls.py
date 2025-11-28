from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import routers, permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from . import views
from .swagger_info import swagger_info

# Schema View برای Swagger
schema_view = get_schema_view(
    swagger_info,
    public=True,
    permission_classes=(permissions.AllowAny,),
)

router = routers.DefaultRouter()

# Quiz routes
router.register(r'quizzes', views.QuizViewSet, basename='quiz')

# Slide routes (nested under quizzes)
router.register(r'quizzes/(?P<quiz_pk>\d+)/slides',
                views.SlideViewSet, basename='slide')

# Option routes (nested under questions)
router.register(r'quizzes/(?P<quiz_pk>\d+)/slides/(?P<slide_pk>\d+)/question/options',
                views.OptionViewSet, basename='option')

# Player session routes
router.register(r'player-sessions', views.PlayerSessionViewSet,
                basename='playersession')

# Content management view
content_view = views.ContentViewSet.as_view({
    'get': 'retrieve',
    'put': 'update',
    'delete': 'destroy'
})

# Leaderboard view
leaderboard_view = views.LeaderboardReceiveView.as_view({'post': 'create'})

# Question endpoints
question_view = views.QuestionViewSet.as_view({
    'get': 'retrieve',
    'post': 'create',
    'put': 'update',
    'patch': 'partial_update',
    'delete': 'destroy'
})

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),

    # API Documentation
    path('swagger/', schema_view.with_ui('swagger',
         cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc',
         cache_timeout=0), name='schema-redoc'),
    path('swagger.json/', schema_view.without_ui(cache_timeout=0), name='schema-json'),

    # API routes
    path('api/', include(router.urls)),

    # Question endpoint (nested)
    path('api/quizzes/<int:quiz_pk>/slides/<int:slide_pk>/question/',
         question_view, name='question-detail'),

    # Content endpoint (nested)
    path('api/quizzes/<int:quiz_pk>/slides/<int:slide_pk>/content/',
         content_view, name='slide-content'),

    # Leaderboard endpoint (nested under question)
    path('api/quizzes/<int:quiz_pk>/slides/<int:slide_pk>/question/leaderboard/',
         leaderboard_view, name='question-leaderboard'),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL,
                          document_root=settings.MEDIA_ROOT)

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import routers
from . import views

router = routers.DefaultRouter()

# Quiz routes
router.register(r'quizzes', views.QuizViewSet)

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

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),

    # API routes
    path('api/', include(router.urls)),

    # Question endpoints - با پارامترهای صحیح
    path('api/quizzes/<int:quiz_pk>/slides/<int:slide_pk>/question/',
         views.QuestionViewSet.as_view({
             'get': 'retrieve',
             'post': 'create',
             'put': 'update',
             'patch': 'partial_update',
             'delete': 'destroy'
         }), name='question-detail'),

    # Content endpoint
    path('api/quizzes/<int:quiz_pk>/slides/<int:slide_pk>/content/',
         content_view, name='slide-content'),

    # Leaderboard endpoint
    path('api/quizzes/<int:quiz_pk>/slides/<int:slide_pk>/question/leaderboard/',
         leaderboard_view, name='question-leaderboard'),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL,
                          document_root=settings.MEDIA_ROOT)

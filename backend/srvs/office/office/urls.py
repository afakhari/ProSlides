from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'quizzes', views.QuizViewSet, basename='quiz')
router.register(r'quizzes/(?P<quiz_id>[^/.]+)/managers',
                views.QuizManagerViewSet, basename='quiz-manager')
router.register(
    r'quizzes/(?P<quiz_id>[^/.]+)/slides', views.SlideViewSet, basename='slide')
router.register(r'quizzes/(?P<quiz_id>[^/.]+)/sessions',
                views.QuizSessionViewSet, basename='quiz-session')
router.register(r'quizzes/(?P<quiz_id>[^/.]+)/participants',
                views.ParticipantViewSet, basename='participant')
router.register(r'quizzes/(?P<quiz_id>[^/.]+)/answers',
                views.ParticipantAnswerViewSet, basename='participant-answer')
router.register(r'quizzes/(?P<quiz_id>[^/.]+)/leaderboard',
                views.LeaderboardViewSet, basename='leaderboard')
router.register(r'quizzes/(?P<quiz_id>[^/.]+)/analytics',
                views.AnalyticsViewSet, basename='analytics')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/public-quizzes/', views.PublicQuizListView.as_view(),
         name='public-quizzes'),
    path('api/user/profile/', views.UserProfileView.as_view(), name='user-profile'),
    path('api/auth/', include('rest_framework.urls')),
]

# برای سرویس دادن فایل‌های رسانه در حالت توسعه
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL,
                          document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL,
                          document_root=settings.STATIC_ROOT)

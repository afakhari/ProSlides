from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'quizzes', views.QuizViewSet, basename='quiz')

# Routes nested برای quiz
quiz_router = DefaultRouter()
quiz_router.register(r'slides', views.SlideViewSet, basename='quiz-slides')

# Routes nested برای slide
slide_router = DefaultRouter()
slide_router.register(r'questions', views.QuestionViewSet,
                      basename='slide-questions')

urlpatterns = [
    path('api/', include(router.urls)),
    path('api/quizzes/<int:quiz_pk>/', include(quiz_router.urls)),
    path('api/quizzes/<int:quiz_pk>/slides/<int:slide_pk>/',
         include(slide_router.urls)),
]

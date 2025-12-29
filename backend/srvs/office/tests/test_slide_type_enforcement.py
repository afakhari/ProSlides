import uuid

import pytest
from django.contrib.auth import get_user_model

from backend.srvs.office.office.models import Quiz
from backend.srvs.office.tests.factories import QuizFactory, SlideFactory


def _create_owner():
    User = get_user_model()
    token = uuid.uuid4().hex[:8]
    return User.objects.create_user(
        username=f"owner_{token}",
        password="pass1234",
        email=f"owner_{token}@example.com",
    )


def _create_quiz(owner):
    quiz_fields = {field.name for field in Quiz._meta.get_fields()}
    if "owner" in quiz_fields:
        return QuizFactory(owner=owner)
    return QuizFactory()


@pytest.mark.django_db
def test_question_create_rejects_content_slide(api_client):
    owner = _create_owner()
    quiz = _create_quiz(owner)
    slide = SlideFactory(quiz=quiz, slide_type=2)

    payload = {
        "title": "Bad Question",
        "text": "Should be rejected",
        "question_type": "single",
        "min_point": 0,
        "max_point": 100,
        "time_limit": 30,
        "faster_answers_more_points": False,
        "partial_scoring": False,
    }

    resp = api_client.post(
        f"/api/quizzes/{quiz.id}/slides/{slide.id}/question/",
        payload,
        format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_content_update_rejects_question_slide(api_client):
    owner = _create_owner()
    quiz = _create_quiz(owner)
    slide = SlideFactory(quiz=quiz, slide_type=1)

    resp = api_client.put(
        f"/api/quizzes/{quiz.id}/slides/{slide.id}/content/",
        {"title": "Should be rejected"},
        format="json",
    )
    assert resp.status_code == 400

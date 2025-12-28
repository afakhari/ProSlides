import pytest

from backend.srvs.office.tests.factories import QuizFactory, SlideFactory, UserFactory


@pytest.mark.django_db
def test_question_create_rejects_content_slide(api_client):
    owner = UserFactory()
    quiz = QuizFactory(owner=owner)
    slide = SlideFactory(quiz=quiz, slide_type=2)

    api_client.force_authenticate(user=owner)
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
    owner = UserFactory()
    quiz = QuizFactory(owner=owner)
    slide = SlideFactory(quiz=quiz, slide_type=1)

    api_client.force_authenticate(user=owner)
    resp = api_client.put(
        f"/api/quizzes/{quiz.id}/slides/{slide.id}/content/",
        {"title": "Should be rejected"},
        format="json",
    )
    assert resp.status_code == 400

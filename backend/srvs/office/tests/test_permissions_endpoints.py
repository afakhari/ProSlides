import pytest
from django.test import override_settings

from backend.srvs.office.tests.factories import QuizFactory, QuestionFactory, UserFactory


@pytest.mark.django_db
def test_quiz_list_requires_auth(api_client):
    resp = api_client.get("/api/quizzes/")
    assert resp.status_code == 401

    resp = api_client.get("/api/quizzes/list/")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_slides_list_requires_auth(api_client):
    quiz = QuizFactory()
    resp = api_client.get(f"/api/quizzes/{quiz.id}/slides/")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_export_non_owner_returns_not_found(api_client):
    quiz = QuizFactory()
    other = UserFactory()
    api_client.force_authenticate(user=other)
    resp = api_client.get(f"/api/quizzes/{quiz.id}/export/")
    assert resp.status_code in (404, 403)


@pytest.mark.django_db
@override_settings(EXPORT_SERVICE_TOKEN="test-export-token")
def test_export_service_token_allows_anonymous(api_client):
    quiz = QuizFactory()
    resp = api_client.get(
        f"/api/quizzes/{quiz.id}/export/",
        HTTP_X_EXPORT_TOKEN="test-export-token",
    )
    assert resp.status_code == 200


@pytest.mark.django_db
def test_question_results_requires_auth(api_client):
    question = QuestionFactory()
    resp = api_client.post(
        f"/api/quizzes/{question.slide.quiz_id}/slides/{question.slide_id}/question/results/",
        {"options": []},
        format="json",
    )
    assert resp.status_code == 401


@pytest.mark.django_db
def test_question_results_rejects_non_owner(api_client):
    question = QuestionFactory()
    other = UserFactory()
    api_client.force_authenticate(user=other)
    resp = api_client.post(
        f"/api/quizzes/{question.slide.quiz_id}/slides/{question.slide_id}/question/results/",
        {"options": []},
        format="json",
    )
    assert resp.status_code in (404, 403)

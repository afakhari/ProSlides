import pytest

from backend.srvs.office.tests.factories import QuizFactory, QuestionFactory, UserFactory


@pytest.mark.django_db
def test_quiz_list_requires_auth(api_client):
    resp = api_client.get("/api/quizzes/")
    assert resp.status_code in (401, 403)

    resp = api_client.get("/api/quizzes/list/")
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_slides_list_requires_auth(api_client):
    quiz = QuizFactory()
    resp = api_client.get(f"/api/quizzes/{quiz.id}/slides/")
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_export_non_owner_returns_not_found(api_client):
    quiz = QuizFactory()
    other = UserFactory()
    api_client.force_authenticate(user=other)
    resp = api_client.get(f"/api/quizzes/{quiz.id}/export/")
    assert resp.status_code in (404, 403)


@pytest.mark.django_db
def test_question_results_requires_auth(api_client):
    question = QuestionFactory()
    resp = api_client.post(
        f"/api/quizzes/{question.slide.quiz_id}/slides/{question.slide_id}/question/results/",
        {"options": []},
        format="json",
    )
    assert resp.status_code in (401, 403)


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

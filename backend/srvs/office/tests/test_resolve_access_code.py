import pytest

from backend.srvs.office.tests.factories import QuizFactory


@pytest.mark.django_db
def test_resolve_access_code_requires_param(api_client):
    resp = api_client.get("/api/quizzes/resolve-access-code/")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_resolve_access_code_not_found(api_client):
    resp = api_client.get("/api/quizzes/resolve-access-code/?access_code=ZZZZ99")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_resolve_access_code_returns_quiz_id(api_client):
    quiz = QuizFactory()
    resp = api_client.get(f"/api/quizzes/resolve-access-code/?access_code={quiz.access_code}")
    assert resp.status_code == 200
    assert resp.data["quiz_id"] == quiz.id

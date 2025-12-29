import pytest

from backend.srvs.office.tests.factories import QuizFactory, UserFactory


@pytest.mark.django_db
def test_quiz_create_rejects_invalid_access_code(api_client):
    user = UserFactory()
    payload = {
        "title": "Invalid code quiz",
        "access_code": "bad code!",
    }
    resp = api_client.post("/api/quizzes/", payload, format="json")
    assert resp.status_code == 400
    assert "access_code" in resp.data


@pytest.mark.django_db
def test_quiz_create_rejects_duplicate_access_code(api_client):
    quiz = QuizFactory(access_code="ABCD12")
    payload = {
        "title": "Duplicate code quiz",
        "access_code": quiz.access_code,
    }
    resp = api_client.post("/api/quizzes/", payload, format="json")
    assert resp.status_code == 400
    assert "access_code" in resp.data

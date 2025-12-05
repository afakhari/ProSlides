import pytest
from rest_framework.test import APIClient

from backend.srvs.office.tests.factories import QuizFactory, UserFactory, SlideFactory


@pytest.mark.django_db
def test_register_creates_user(api_client: APIClient):
    payload = {"username": "newuser", "email": "new@example.com", "password": "StrongPass!123"}
    resp = api_client.post("/api/auth/register/", payload, format="json")
    assert resp.status_code == 201
    assert resp.data["username"] == "newuser"


@pytest.mark.django_db
def test_owner_can_list_own_quizzes(api_client: APIClient):
    owner = UserFactory()
    QuizFactory(owner=owner)
    api_client.force_authenticate(user=owner)

    resp = api_client.get("/api/quizzes/")
    assert resp.status_code == 200
    assert len(resp.data) == 1


@pytest.mark.django_db
def test_non_owner_cannot_access_others_quiz(api_client: APIClient):
    owner = UserFactory()
    other = UserFactory()
    quiz = QuizFactory(owner=owner)

    api_client.force_authenticate(user=other)
    resp = api_client.get(f"/api/quizzes/{quiz.id}/")
    assert resp.status_code in (404, 403)


@pytest.mark.django_db
def test_non_owner_cannot_create_slide_on_foreign_quiz(api_client: APIClient):
    owner = UserFactory()
    other = UserFactory()
    quiz = QuizFactory(owner=owner)

    api_client.force_authenticate(user=other)
    resp = api_client.post(
        f"/api/quizzes/{quiz.id}/slides/",
        {"slide_type": 1, "order": 1},
        format="json",
    )
    assert resp.status_code in (404, 403)


@pytest.mark.django_db
def test_export_requires_auth(api_client: APIClient):
    quiz = QuizFactory()
    SlideFactory(quiz=quiz, slide_type=1)

    resp = api_client.get(f"/api/quizzes/{quiz.id}/export/")
    assert resp.status_code in (401, 403)

    api_client.force_authenticate(user=quiz.owner)
    resp_auth = api_client.get(f"/api/quizzes/{quiz.id}/export/")
    assert resp_auth.status_code == 200

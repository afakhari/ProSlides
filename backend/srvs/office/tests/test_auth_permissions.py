import pytest
from rest_framework.test import APIClient

from django.core import mail
from django.test import override_settings

from backend.srvs.office.office.models import EmailVerification
from backend.srvs.office.tests.factories import QuizFactory, UserFactory, SlideFactory


@pytest.mark.django_db
def test_register_creates_user(api_client: APIClient):
    payload = {"username": "newuser", "email": "new@example.com", "password": "StrongPass!123"}
    resp = api_client.post("/api/auth/register/", payload, format="json")
    assert resp.status_code == 201
    assert resp.data["username"] == "newuser"
    assert resp.data["is_active"] is False
    assert resp.data["verification_sent"] is True

    verification = EmailVerification.objects.filter(user__email="new@example.com").first()
    assert verification is not None
    assert verification.code is not None


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


@pytest.mark.django_db
def test_verify_email_activates_user(api_client: APIClient):
    payload = {"username": "verifyuser", "email": "verify@example.com", "password": "StrongPass!123"}
    resp = api_client.post("/api/auth/register/", payload, format="json")
    assert resp.status_code == 201

    verification = EmailVerification.objects.get(user__email="verify@example.com")
    verify_payload = {"email": "verify@example.com", "code": verification.code}
    verify_resp = api_client.post("/api/auth/verify/", verify_payload, format="json")
    assert verify_resp.status_code == 200

    verification.refresh_from_db()
    assert verification.is_verified is True
    assert verification.code is None


@pytest.mark.django_db
def test_verify_email_rejects_wrong_code(api_client: APIClient):
    payload = {"username": "wrongcode", "email": "wrong@example.com", "password": "StrongPass!123"}
    api_client.post("/api/auth/register/", payload, format="json")
    verification = EmailVerification.objects.get(user__email="wrong@example.com")

    verify_payload = {"email": "wrong@example.com", "code": "000000"}
    resp = api_client.post("/api/auth/verify/", verify_payload, format="json")
    assert resp.status_code == 400

    verification.refresh_from_db()
    assert verification.attempts == 1


@pytest.mark.django_db
def test_register_rejects_duplicate_email(api_client: APIClient):
    payload = {"username": "firstuser", "email": "dup@example.com", "password": "StrongPass!123"}
    resp1 = api_client.post("/api/auth/register/", payload, format="json")
    assert resp1.status_code == 201

    payload2 = {"username": "seconduser", "email": "dup@example.com", "password": "StrongPass!123"}
    resp2 = api_client.post("/api/auth/register/", payload2, format="json")
    assert resp2.status_code == 400


@pytest.mark.django_db
@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
def test_password_reset_flow(api_client: APIClient):
    user = UserFactory(email="reset@example.com")
    user.is_active = True
    user.set_password("OldStrongPass!123")
    user.save()

    resp = api_client.post(
        "/api/auth/password/reset/",
        {"email": "reset@example.com"},
        format="json",
    )
    assert resp.status_code == 200
    assert len(mail.outbox) == 1

    body = mail.outbox[0].body
    assert "reset-password" in body
    uid = body.split("uid=")[1].split("&")[0]
    token = body.split("token=")[1].split()[0]

    confirm = api_client.post(
        "/api/auth/password/reset/confirm/",
        {"uid": uid, "token": token, "new_password": "NewStrongPass!123"},
        format="json",
    )
    assert confirm.status_code == 200

    login = api_client.post(
        "/api/auth/token/",
        {"username": user.username, "password": "NewStrongPass!123"},
        format="json",
    )
    assert login.status_code == 200


@pytest.mark.django_db
def test_logout_blacklists_refresh_token(api_client: APIClient):
    user = UserFactory()
    user.is_active = True
    user.set_password("StrongPass!123")
    user.save()

    login = api_client.post(
        "/api/auth/token/",
        {"username": user.username, "password": "StrongPass!123"},
        format="json",
    )
    assert login.status_code == 200
    refresh = login.data["refresh"]

    api_client.force_authenticate(user=user)
    logout = api_client.post("/api/auth/logout/", {"refresh": refresh}, format="json")
    assert logout.status_code == 200

    refresh_resp = api_client.post(
        "/api/auth/token/refresh/",
        {"refresh": refresh},
        format="json",
    )
    assert refresh_resp.status_code == 401

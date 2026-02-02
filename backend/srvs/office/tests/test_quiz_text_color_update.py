import pytest

from backend.srvs.office.tests.factories import QuizFactory, UserFactory


@pytest.mark.django_db
def test_quiz_patch_updates_text_color(api_client):
    user = UserFactory()
    quiz = QuizFactory(owner=user, text_color="#ffffff")

    api_client.force_authenticate(user=user)
    resp = api_client.patch(
        f"/api/quizzes/{quiz.id}/",
        {"text_color": "#111827"},
        format="json",
    )

    assert resp.status_code == 200
    quiz.refresh_from_db()
    assert quiz.text_color == "#111827"
    assert resp.data["text_color"] == "#111827"

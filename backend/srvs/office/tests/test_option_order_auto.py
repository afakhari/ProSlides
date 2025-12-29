import pytest

from backend.srvs.office.tests.factories import QuestionFactory


@pytest.mark.django_db
def test_option_order_auto_increments(api_client):
    question = QuestionFactory()
    url = f"/api/quizzes/{question.slide.quiz_id}/slides/{question.slide_id}/question/options/"

    first = api_client.post(url, {"text": "A", "is_correct": False}, format="json")
    second = api_client.post(url, {"text": "B", "is_correct": False}, format="json")

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.data["order"] == 1
    assert second.data["order"] == 2

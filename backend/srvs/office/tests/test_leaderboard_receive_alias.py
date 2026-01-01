import pytest
from django.test import override_settings

from backend.srvs.office.tests.factories import QuizFactory, SlideFactory, QuestionFactory


@pytest.mark.django_db
@override_settings(EXPORT_SERVICE_TOKEN="test-export-token")
def test_leaderboard_accepts_user_id_alias(api_client):
    quiz = QuizFactory()
    question = QuestionFactory(slide=SlideFactory(quiz=quiz, slide_type=1))
    payload = {
        "leaderboard": [
            {
                "user_id": "legacy-session",
                "player_name": "Legacy",
                "avatar": "L",
                "score": 10,
                "time_taken": 1.2,
                "rank": 1,
            }
        ]
    }

    resp = api_client.post(
        f"/api/quizzes/{quiz.id}/slides/{question.slide_id}/question/leaderboard/",
        payload,
        format="json",
        HTTP_X_EXPORT_TOKEN="test-export-token",
    )
    assert resp.status_code == 200
    assert resp.data["saved_entries"] == 1

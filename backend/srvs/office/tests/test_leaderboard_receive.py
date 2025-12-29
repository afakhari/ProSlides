import pytest

from backend.srvs.office.tests.factories import (
    QuizFactory,
    SlideFactory,
    QuestionFactory,
    PlayerSessionFactory,
)
from backend.srvs.office.office.models import Leaderboard, PlayerSession


@pytest.mark.django_db
def test_leaderboard_receive_saves_entries(api_client):
    quiz = QuizFactory()
    question = QuestionFactory(slide=SlideFactory(quiz=quiz, slide_type=1))

    player = PlayerSessionFactory(quiz=quiz)

    payload = {
        "leaderboard": [
            {
                "rust_session_id": player.rust_session_id,
                "player_name": player.player_name,
                "avatar": player.avatar,
                "score": 120,
                "time_taken": 3.5,
                "rank": 1,
            },
            {
                "rust_session_id": "missing-player",
                "player_name": "new-player",
                "avatar": "NP",
                "score": 50,
                "time_taken": 4.2,
                "rank": 2,
            },
        ]
    }

    api_client.force_authenticate(user=quiz.owner)
    resp = api_client.post(
        f"/api/quizzes/{quiz.id}/slides/{question.slide_id}/question/leaderboard/",
        payload,
        format="json",
    )

    # یک ورودی ذخیره می‌شود، دیگری خطا می‌دهد
    assert resp.status_code == 200
    assert resp.data["saved_entries"] == 2
    assert resp.data["total_entries"] == 2
    assert "errors" not in resp.data

    saved = Leaderboard.objects.filter(question=question).first()
    assert saved is not None
    assert saved.player_name == player.player_name
    assert saved.rank == 1
    assert PlayerSession.objects.filter(
        rust_session_id="missing-player",
        quiz=quiz,
    ).exists()


@pytest.mark.django_db
def test_leaderboard_receive_missing_question(api_client):
    quiz = QuizFactory()
    payload = {
        "leaderboard": [
            {
                "rust_session_id": "any",
                "player_name": "any",
                "avatar": "A1",
                "score": 10,
                "time_taken": 1.0,
                "rank": 1,
            }
        ]
    }

    api_client.force_authenticate(user=quiz.owner)
    resp = api_client.post(
        f"/api/quizzes/{quiz.id}/slides/999/question/leaderboard/",
        payload,
        format="json",
    )
    assert resp.status_code == 404

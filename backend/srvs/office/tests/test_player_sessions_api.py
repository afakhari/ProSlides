import pytest

from backend.srvs.office.tests.factories import QuizFactory, PlayerSessionFactory, UserFactory


@pytest.mark.django_db
@pytest.mark.filterwarnings("ignore::django.core.paginator.UnorderedObjectListWarning")
def test_player_session_create_and_list_scoped_to_owner(api_client):
    owner = UserFactory()
    other = UserFactory()
    quiz = QuizFactory(owner=owner)
    other_quiz = QuizFactory(owner=other)

    api_client.force_authenticate(user=owner)
    create_resp = api_client.post(
        "/api/player-sessions/",
        {"rust_session_id": "session-123", "quiz": quiz.id, "player_name": "Player", "avatar": "A"},
        format="json",
    )
    assert create_resp.status_code == 201

    PlayerSessionFactory(quiz=other_quiz)

    list_resp = api_client.get("/api/player-sessions/?page_size=10")
    assert list_resp.status_code == 200
    assert list_resp.data["count"] == 1
    assert len(list_resp.data["results"]) == 1


@pytest.mark.django_db
def test_player_sessions_require_auth(api_client):
    quiz = QuizFactory()
    resp = api_client.get("/api/player-sessions/")
    assert resp.status_code == 401

    resp = api_client.post(
        "/api/player-sessions/",
        {"rust_session_id": "session-123", "quiz": quiz.id, "player_name": "Player", "avatar": "A"},
        format="json",
    )
    assert resp.status_code == 401

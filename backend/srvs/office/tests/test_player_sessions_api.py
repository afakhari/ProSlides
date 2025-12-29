import pytest

from backend.srvs.office.tests.factories import QuizFactory


@pytest.mark.django_db
@pytest.mark.filterwarnings("ignore::django.core.paginator.UnorderedObjectListWarning")
def test_player_session_create_and_list(api_client):
    quiz = QuizFactory()
    api_client.force_authenticate(user=quiz.owner)
    payload = {
        "quiz": quiz.id,
        "player_name": "Player",
        "avatar": "A",
    }
    create_resp = api_client.post(
        "/api/player-sessions/",
        {**payload, "rust_session_id": "session-123"},
        format="json",
    )
    assert create_resp.status_code == 201
    create_resp = api_client.post(
        "/api/player-sessions/",
        {**payload, "rust_session_id": "session-456"},
        format="json",
    )
    assert create_resp.status_code == 201

    list_resp = api_client.get("/api/player-sessions/?page_size=1")
    assert list_resp.status_code == 200
    assert list_resp.data["count"] == 2
    assert len(list_resp.data["results"]) == 1
    assert list_resp.data["total_pages"] == 2

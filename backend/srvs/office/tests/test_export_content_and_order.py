import pytest

from backend.srvs.office.tests.factories import QuizFactory, SlideFactory, QuestionFactory, OptionFactory


@pytest.mark.django_db
def test_export_includes_content_slide_fields(api_client):
    quiz = QuizFactory()
    slide = SlideFactory(
        quiz=quiz,
        slide_type=2,
        title="Content title",
        content_text="Content body",
        content_image_url="http://example.com/img.png",
    )

    api_client.force_authenticate(user=quiz.owner)
    resp = api_client.get(f"/api/quizzes/{quiz.id}/export/")
    assert resp.status_code == 200

    slides = resp.data["slides"]
    assert len(slides) == 1
    assert slides[0]["slide_id"] == slide.id
    assert slides[0]["slide_type"] == 2
    assert slides[0]["title"] == "Content title"
    assert slides[0]["content_text"] == "Content body"
    assert slides[0]["content_image_url"] == "http://example.com/img.png"
    assert slides[0]["question"] is None


@pytest.mark.django_db
def test_export_preserves_order_and_inserts_leaderboard(api_client):
    quiz = QuizFactory()
    question = QuestionFactory(
        slide__quiz=quiz,
        slide__order=1,
        slide__show_leaderboard_after=True,
    )
    OptionFactory.create_batch(2, question=question)
    content = SlideFactory(
        quiz=quiz,
        slide_type=2,
        order=2,
        title="Content",
    )

    api_client.force_authenticate(user=quiz.owner)
    resp = api_client.get(f"/api/quizzes/{quiz.id}/export/")
    assert resp.status_code == 200

    slides = resp.data["slides"]
    assert [item["slide_type"] for item in slides] == [1, 3, 2]
    assert slides[0]["slide_id"] == question.slide_id
    assert slides[1]["slide_id"] == question.slide_id
    assert slides[2]["slide_id"] == content.id

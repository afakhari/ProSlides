import pytest

from backend.srvs.office.tests.factories import QuizFactory, QuestionFactory, OptionFactory


@pytest.mark.django_db
def test_export_includes_quiz_and_slides(api_client):
    quiz = QuizFactory(background_color="#123456")
    question = QuestionFactory(slide__quiz=quiz)
    OptionFactory.create_batch(3, question=question)

    resp = api_client.get(f"/api/quizzes/{quiz.id}/export/")
    assert resp.status_code == 200

    data = resp.data
    assert data["quiz_id"] == quiz.id
    assert data["title"] == quiz.title
    assert data["background"]["color"] == "#123456"

    slides = data["slides"]
    assert len(slides) == 1
    slide = slides[0]
    assert slide["slide_type"] == 1
    assert slide["question"]["question_id"] == question.id
    assert len(slide["question"]["options"]) == 3

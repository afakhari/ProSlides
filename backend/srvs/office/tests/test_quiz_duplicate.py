import pytest

from backend.srvs.office.office.models import Slide, Question, Option
from backend.srvs.office.tests.factories import QuizFactory, SlideFactory, QuestionFactory, OptionFactory


@pytest.mark.django_db
def test_duplicate_quiz_copies_slides_questions_and_options(api_client):
    quiz = QuizFactory(title="Sample Quiz")
    question = QuestionFactory(
        slide__quiz=quiz,
        slide__order=1,
        title="Q1",
        text="Question text",
    )
    OptionFactory(question=question, order=1, text="A", is_correct=True)
    OptionFactory(question=question, order=2, text="B", is_correct=False)
    SlideFactory(
        quiz=quiz,
        slide_type=2,
        order=2,
        title="Content",
        content_text="Body",
    )

    resp = api_client.post(f"/api/quizzes/{quiz.id}/duplicate/")
    assert resp.status_code == 201

    new_quiz_id = resp.data["quiz_id"]
    assert new_quiz_id != quiz.id
    assert "(copy" in resp.data["title"]
    assert resp.data["participants_count"] == 0
    assert resp.data["access_code"] != quiz.access_code

    slides = Slide.objects.filter(quiz_id=new_quiz_id).order_by("order")
    assert slides.count() == 2
    new_question_slide = slides.first()
    new_content_slide = slides.last()
    assert new_question_slide.slide_type == 1
    assert new_content_slide.slide_type == 2

    new_question = Question.objects.get(slide=new_question_slide)
    assert new_question.title == "Q1"
    assert new_question.text == "Question text"

    options = list(Option.objects.filter(question=new_question).order_by("order"))
    assert [opt.text for opt in options] == ["A", "B"]
    assert [opt.is_correct for opt in options] == [True, False]

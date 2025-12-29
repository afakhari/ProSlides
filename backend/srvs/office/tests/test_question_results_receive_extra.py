import pytest

from backend.srvs.office.tests.factories import QuestionFactory, OptionFactory


@pytest.mark.django_db
def test_question_results_rejects_option_from_other_question(api_client):
    question = QuestionFactory()
    other_question = QuestionFactory()
    opt1 = OptionFactory(question=question)
    opt2 = OptionFactory(question=question)
    foreign_option = OptionFactory(question=other_question)

    payload = {
        "options": [
            {"option_id": opt1.id, "number_of_submits": 1},
            {"option_id": opt2.id, "number_of_submits": 2},
            {"option_id": foreign_option.id, "number_of_submits": 3},
        ]
    }

    resp = api_client.post(
        f"/api/quizzes/{question.slide.quiz_id}/slides/{question.slide_id}/question/results/",
        payload,
        format="json",
    )
    assert resp.status_code == 400
    assert "unexpected_option_ids" in resp.data

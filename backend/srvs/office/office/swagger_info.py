from drf_yasg import openapi

swagger_info = openapi.Info(
    title="ProSlides API",
    default_version="v1",
    description="""
# ProSlides API

Stable REST API for authoring and running interactive quizzes.

## Core Concepts
- **Quiz**: top-level container.
- **Slide**: ordered items inside a quiz (question or content).
- **Question**: configuration and scoring rules for question slides.
- **Option**: available answers for a question.
- **Player Session**: live participant record.
- **Leaderboard**: per-question scoring records.

## Typical Flow
1) Create a quiz and slides.
2) Export quiz data for the player client.
3) Receive leaderboard updates per question.
4) Use final leaderboard or reset results if needed.

## Pagination
Endpoints that return lists use page-number pagination.
- Query params: `page`, `page_size`
- Response shape: `{ count, page, page_size, total_pages, next, previous, results }`
""",
    contact=openapi.Contact(name="ProSlides Team", email="support@proslides.com"),
    terms_of_service="https://proslides.ir/terms",
    license=openapi.License(name="MIT License"),
)

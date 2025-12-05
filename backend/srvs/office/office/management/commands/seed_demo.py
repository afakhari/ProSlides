from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from backend.srvs.office.office import models


class Command(BaseCommand):
    help = "Create a full demo quiz with slides, questions, options, and sample leaderboard data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--title",
            default="Demo Quiz",
            help="Title for the demo quiz (default: Demo Quiz)",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Remove any existing quiz with the same title before seeding.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        title = options["title"]
        reset = options["reset"]

        if reset:
            deleted, _ = models.Quiz.objects.filter(title=title).delete()
            self.stdout.write(self.style.WARNING(f"Removed {deleted} existing quiz(es) titled '{title}'"))

        quiz = models.Quiz.objects.create(
            title=title,
            created_at=timezone.now(),
            author="demo_author",
            music_url="https://example.com/music.mp3",
            background_color="#123456",
            background_image_url="https://example.com/background.jpg",
        )
        self.stdout.write(self.style.SUCCESS(f"Created quiz '{quiz.title}' (id={quiz.id})"))

        slides = []
        # Slide 1: single-choice question
        slides.append(
            models.Slide.objects.create(
                quiz=quiz,
                slide_type=1,
                order=1,
                show_leaderboard_after=True,
            )
        )
        q1 = models.Question.objects.create(
            slide=slides[-1],
            title="Capital of France",
            text="What is the capital of France?",
            question_type="single",
            min_point=0,
            max_point=100,
            time_limit=20,
            image_url=None,
            faster_answers_more_points=True,
            partial_scoring=False,
        )
        models.Option.objects.bulk_create(
            [
                models.Option(question=q1, text="Paris", is_correct=True, votes=8),
                models.Option(question=q1, text="Berlin", is_correct=False, votes=1),
                models.Option(question=q1, text="Madrid", is_correct=False, votes=1),
                models.Option(question=q1, text="Rome", is_correct=False, votes=0),
            ]
        )

        # Slide 2: multi-choice question
        slides.append(
            models.Slide.objects.create(
                quiz=quiz,
                slide_type=1,
                order=2,
                show_leaderboard_after=True,
            )
        )
        q2 = models.Question.objects.create(
            slide=slides[-1],
            title="Prime Numbers",
            text="Select all prime numbers.",
            question_type="multiple",
            min_point=0,
            max_point=120,
            time_limit=30,
            image_url=None,
            faster_answers_more_points=False,
            partial_scoring=True,
        )
        models.Option.objects.bulk_create(
            [
                models.Option(question=q2, text="2", is_correct=True, votes=5),
                models.Option(question=q2, text="3", is_correct=True, votes=4),
                models.Option(question=q2, text="4", is_correct=False, votes=2),
                models.Option(question=q2, text="5", is_correct=True, votes=3),
            ]
        )

        # Slide 3: content slide (instructions)
        slides.append(
            models.Slide.objects.create(
                quiz=quiz,
                slide_type=2,
                order=3,
                show_leaderboard_after=False,
                title="Break",
                content_text="Take a short break and get ready for the next questions.",
                content_image_url="https://example.com/break.png",
            )
        )

        # Sample player sessions and leaderboard entries for q1
        players = [
            models.PlayerSession.objects.create(
                user_id="player-1",
                quiz=quiz,
                player_name="Alice",
                avatar=":)",
            ),
            models.PlayerSession.objects.create(
                user_id="player-2",
                quiz=quiz,
                player_name="Bob",
                avatar=":D",
            ),
            models.PlayerSession.objects.create(
                user_id="player-3",
                quiz=quiz,
                player_name="Charlie",
                avatar=":P",
            ),
        ]

        leaderboard_entries = [
            models.Leaderboard(
                question=q1,
                user_id=players[0].user_id,
                player_name=players[0].player_name,
                avatar=players[0].avatar,
                score=95,
                time_taken=4.5,
                rank=1,
            ),
            models.Leaderboard(
                question=q1,
                user_id=players[1].user_id,
                player_name=players[1].player_name,
                avatar=players[1].avatar,
                score=70,
                time_taken=7.2,
                rank=2,
            ),
            models.Leaderboard(
                question=q1,
                user_id=players[2].user_id,
                player_name=players[2].player_name,
                avatar=players[2].avatar,
                score=40,
                time_taken=10.8,
                rank=3,
            ),
        ]
        models.Leaderboard.objects.bulk_create(leaderboard_entries)

        self.stdout.write(self.style.SUCCESS("Seed data created successfully"))

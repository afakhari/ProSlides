import random
from django.db import transaction
from backend.srvs.office.office.models import Quiz, PickAnswerQuestion, Option, Participant, Answer
from django.contrib.auth.models import User
import os
import sys
import django

# ابتدا محیط Django را تنظیم کنیم
os.environ.setdefault('DJANGO_SETTINGS_MODULE',
                      'backend.srvs.office.office.settings')

# اضافه کردن مسیر پروژه به Python path
sys.path.append(os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__)))))
# حالا Django را setup کنیم
django.setup()

# بعد از setup کردن Django می‌توانیم مدل‌ها را import کنیم


def create_sample_data():
    """ایجاد داده‌های نمونه برای توسعه فرانت‌اند"""

    print("🔄 در حال ایجاد داده‌های نمونه...")

    # ایجاد کاربر پیش‌فرض اگر وجود ندارد
    user, created = User.objects.get_or_create(
        username='demo_teacher',
        defaults={
            'email': 'teacher@proslides.com',
            'first_name': 'استاد',
            'last_name': 'نمونه',
            'is_active': True
        }
    )
    if created:
        user.set_password('demo123')
        user.save()
        print("✅ کاربر دمو ایجاد شد")

    with transaction.atomic():
        # 1. ایجاد کوئیز نمونه - ریاضی
        math_quiz = Quiz.objects.create(
            title="آزمون ریاضی مقدماتی",
            created_by=user,
            default_time_per_question=30,
            points_calculation='accuracy_based',
            allow_retries=False
        )
        print(f"✅ کوئیز ریاضی ایجاد شد: {math_quiz.title}")

        # سوالات ریاضی
        math_questions_data = [
            {
                'title': 'عملیات پایه',
                'question_text': 'حاصل عبارت ۲ + ۲ × ۲ چیست؟',
                'order': 1,
                'time_limit': 25,
                'max_points': 100,
                'min_points': 10,
                'options': [
                    {'text': '۶', 'is_correct': False,
                        'order': 1, 'explanation': 'اشتباه است'},
                    {'text': '۸', 'is_correct': False,
                        'order': 2, 'explanation': 'اشتباه است'},
                    {'text': '۴', 'is_correct': False,
                        'order': 3, 'explanation': 'اشتباه است'},
                    {'text': '۶ (با اولویت ضرب)', 'is_correct': True, 'order': 4,
                     'explanation': 'صحیح! طبق اولویت عملیات، ضرب مقدم بر جمع است'}
                ]
            },
            {
                'title': 'هندسه',
                'question_text': 'مساحت دایره‌ای با شعاع ۵ سانتی‌متر چقدر است؟ (π = 3.14)',
                'order': 2,
                'time_limit': 40,
                'max_points': 100,
                'min_points': 20,
                'options': [
                    {'text': '۲۵π', 'is_correct': False, 'order': 1,
                        'explanation': 'این مساحت نیست'},
                    {'text': '۷۸.۵ سانتی‌متر مربع', 'is_correct': True, 'order': 2,
                        'explanation': 'صحیح! مساحت = π × r² = 3.14 × 25 = 78.5'},
                    {'text': '۳۱.۴ سانتی‌متر مربع', 'is_correct': False,
                        'order': 3, 'explanation': 'این محیط دایره است'},
                    {'text': '۱۵.۷ سانتی‌متر مربع', 'is_correct': False,
                        'order': 4, 'explanation': 'اشتباه است'}
                ]
            }
        ]

        for q_data in math_questions_data:
            question = PickAnswerQuestion.objects.create(
                quiz=math_quiz,
                title=q_data['title'],
                question_text=q_data['question_text'],
                order=q_data['order'],
                time_limit=q_data['time_limit'],
                max_points=q_data['max_points'],
                min_points=q_data['min_points']
            )

            for opt_data in q_data['options']:
                Option.objects.create(
                    question=question,
                    text=opt_data['text'],
                    is_correct=opt_data['is_correct'],
                    order=opt_data['order'],
                    explanation=opt_data['explanation']
                )

        print(f"✅ {len(math_questions_data)} سوال ریاضی ایجاد شد")

        # 2. ایجاد کوئیز نمونه - علوم
        science_quiz = Quiz.objects.create(
            title="آزمون علوم تجربی",
            created_by=user,
            default_time_per_question=20,
            points_calculation='time_based',
            allow_retries=True
        )
        print(f"✅ کوئیز علوم ایجاد شد: {science_quiz.title}")

        science_questions_data = [
            {
                'title': 'سیاره‌ها',
                'question_text': 'کدام سیاره به عنوان "سیاره سرخ" شناخته می‌شود؟',
                'order': 1,
                'time_limit': 15,
                'max_points': 80,
                'min_points': 5,
                'options': [
                    {'text': 'مریخ', 'is_correct': True, 'order': 1,
                        'explanation': 'صحیح! مریخ به دلیل اکسید آهن روی سطحش سرخ رنگ است'},
                    {'text': 'زهره', 'is_correct': False, 'order': 2,
                        'explanation': 'زهره سیاره زرد-سفید است'},
                    {'text': 'مشتری', 'is_correct': False, 'order': 3,
                        'explanation': 'مشتری سیاره گازی با نوارهای رنگی است'},
                    {'text': 'زحل', 'is_correct': False, 'order': 4,
                        'explanation': 'زحل به حلقه‌هایش معروف است'}
                ]
            }
        ]

        for q_data in science_questions_data:
            question = PickAnswerQuestion.objects.create(
                quiz=science_quiz,
                title=q_data['title'],
                question_text=q_data['question_text'],
                order=q_data['order'],
                time_limit=q_data['time_limit'],
                max_points=q_data['max_points'],
                min_points=q_data['min_points']
            )

            for opt_data in q_data['options']:
                Option.objects.create(
                    question=question,
                    text=opt_data['text'],
                    is_correct=opt_data['is_correct'],
                    order=opt_data['order'],
                    explanation=opt_data['explanation']
                )

        print(f"✅ {len(science_questions_data)} سوال علوم ایجاد شد")

        # 3. ایجاد شرکت‌کنندگان نمونه
        participants_data = [
            {'name': 'علی', 'avatar': '🎓', 'is_host': True},
            {'name': 'مریم', 'avatar': '👩‍🔬', 'is_host': False},
            {'name': 'رضا', 'avatar': '🚀', 'is_host': False}
        ]

        for p_data in participants_data:
            Participant.objects.create(
                quiz=math_quiz,
                name=p_data['name'],
                avatar=p_data['avatar'],
                is_host=p_data['is_host'],
                total_points=random.randint(50, 200)
            )

        print(f"✅ {len(participants_data)} شرکت‌کننده برای کوئیز ریاضی ایجاد شد")

        # 4. ایجاد پاسخ‌های نمونه
        math_participants = Participant.objects.filter(quiz=math_quiz)
        math_questions = PickAnswerQuestion.objects.filter(quiz=math_quiz)

        answers_created = 0
        for participant in math_participants:
            for question in math_questions:
                # انتخاب تصادفی یک گزینه
                options = question.options.all()
                selected_option = random.choice(options)

                Answer.objects.create(
                    participant=participant,
                    question=question,
                    selected_option=selected_option,
                    submit_time=random.uniform(5, 25),
                    points_earned=random.randint(
                        10, 100) if selected_option.is_correct else 0
                )
                answers_created += 1

        print(f"✅ {answers_created} پاسخ نمونه ایجاد شد")

        # 5. ایجاد یک کوئیز خالی برای تست
        empty_quiz = Quiz.objects.create(
            title="کوئیز تستی (خالی)",
            created_by=user,
            default_time_per_question=30,
            points_calculation='fixed',
            allow_retries=False
        )
        print(f"✅ کوئیز خالی برای تست ایجاد شد: {empty_quiz.title}")

    print("\n🎉 داده‌های نمونه با موفقیت ایجاد شدند!")
    print("\n📊 خلاصه داده‌های ایجاد شده:")
    print(f"   - تعداد کوئیزها: {Quiz.objects.count()}")
    print(f"   - تعداد سوالات: {PickAnswerQuestion.objects.count()}")
    print(f"   - تعداد گزینه‌ها: {Option.objects.count()}")
    print(f"   - تعداد شرکت‌کنندگان: {Participant.objects.count()}")
    print(f"   - تعداد پاسخ‌ها: {Answer.objects.count()}")

    print("\n🔗 دسترسی به داده‌ها:")
    print(
        f"   - کوئیز ریاضی: http://127.0.0.1:8000/api/quizzes/{math_quiz.id}/")
    print(
        f"   - کوئیز علوم: http://127.0.0.1:8000/api/quizzes/{science_quiz.id}/")
    print(f"   - مستندات API: http://127.0.0.1:8000/swagger/")


def clear_sample_data():
    """پاک کردن همه داده‌های نمونه"""
    confirm = input(
        "⚠️  آیا مطمئن هستید که می‌خواهید همه داده‌ها را پاک کنید؟ (y/n): ")
    if confirm.lower() == 'y':
        with transaction.atomic():
            Answer.objects.all().delete()
            Participant.objects.all().delete()
            Option.objects.all().delete()
            PickAnswerQuestion.objects.all().delete()
            Quiz.objects.all().delete()
            User.objects.filter(username='demo_teacher').delete()
        print("🧹 همه داده‌های نمونه پاک شدند")
    else:
        print("❌ عملیات لغو شد")


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'clear':
        clear_sample_data()
    else:
        create_sample_data()

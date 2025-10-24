# utils.py
import math
import logging
from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
from .models import Participant, ParticipantAnswer, Slide, SlideOption, QuizSession, LeaderboardSnapshot

logger = logging.getLogger(__name__)


def calculate_points(slide, is_correct, response_time):
    """
    محاسبه امتیاز با در نظر گرفتن صحیح/غلط، سرعت پاسخ و نوع سوال

    Args:
        slide: شیء اسلاید
        is_correct: آیا پاسخ صحیح است
        response_time: زمان پاسخ به ثانیه

    Returns:
        int: امتیاز محاسبه شده
    """
    if not is_correct:
        return 0

    # برای نظرسنجی‌ها امتیاز ثابت
    if slide.slide_type == 'poll':
        return slide.points

    # برای سوالات متنی امتیاز کامل
    if slide.slide_type == 'text_answer':
        return slide.points

    # برای سوالات چندگزینه‌ای و صحیح/غلط محاسبه بر اساس سرعت
    if response_time <= 0:
        return slide.points

    # محاسبه امتیاز بر اساس سرعت پاسخ
    time_ratio = min(response_time / slide.time_limit, 1.0)
    speed_bonus = max(0, 1 - time_ratio)  # هرچه سریع‌تر، امتیاز بیشتر

    # امتیاز پایه + پاداش سرعت (حداکثر ۵۰٪ امتیاز پایه)
    points = slide.points + math.floor(speed_bonus * slide.points * 0.5)
    return max(points, 1)  # حداقل 1 امتیاز


def calculate_correctness(slide, answer_data):
    """
    بررسی صحیح بودن پاسخ بر اساس نوع سوال

    Args:
        slide: شیء اسلاید
        answer_data: دیکشنری حاوی داده‌های پاسخ

    Returns:
        bool or None: صحیح/غلط/None (برای سوالات متنی)
    """
    try:
        if slide.slide_type in ['multiple_choice', 'true_false']:
            selected_option_id = answer_data.get('selected_option_id')
            if not selected_option_id:
                return False

            # پیدا کردن گزینه انتخاب شده
            selected_option = SlideOption.objects.get(
                id=selected_option_id,
                slide=slide
            )
            return selected_option.is_correct

        elif slide.slide_type == 'text_answer':
            # برای سوالات متنی، نیاز به بررسی دستی توسط مدیر/مالک دارد
            return None

        elif slide.slide_type == 'poll':
            # نظرسنجی‌ها همیشه صحیح در نظر گرفته می‌شوند (فقط مشارکت مهم است)
            return True

        else:
            # برای انواع دیگر سوالات
            return False

    except SlideOption.DoesNotExist:
        logger.warning(
            f"گزینه پیدا نشد: {answer_data.get('selected_option_id')} برای اسلاید {slide.id}")
        return False
    except Exception as e:
        logger.error(f"خطا در محاسبه صحیح بودن پاسخ: {e}")
        return False


def generate_leaderboard_data(session, limit=20):
    """
    تولید داده‌های لیدربرد برای جلسه

    Args:
        session: شیء جلسه
        limit: محدودیت تعداد شرکت‌کنندگان در لیدربرد

    Returns:
        list: لیست شرکت‌کنندگان به ترتیب امتیاز
    """
    try:
        # شرکت‌کنندگان فعال در این جلسه، مرتب شده بر اساس امتیاز
        participants = Participant.objects.filter(
            quiz=session.quiz
        ).select_related().order_by('-total_score', 'joined_at')[:limit]

        leaderboard = []
        for rank, participant in enumerate(participants, 1):
            # محاسبه تعداد پاسخ‌های صحیح
            correct_answers_count = ParticipantAnswer.objects.filter(
                participant=participant,
                is_correct=True,
                session=session
            ).count()

            # محاسبه تعداد کل پاسخ‌ها
            total_answers_count = ParticipantAnswer.objects.filter(
                participant=participant,
                session=session
            ).count()

            # محاسبه نرخ دقت
            accuracy_rate = 0
            if total_answers_count > 0:
                accuracy_rate = round(
                    (correct_answers_count / total_answers_count) * 100, 1)

            leaderboard.append({
                'rank': rank,
                'participant_id': str(participant.id),
                'session_id': participant.session_id,
                'full_name': participant.full_name,
                'avatar': participant.avatar,
                'total_score': participant.total_score,
                'current_streak': participant.current_streak,
                'correct_answers': correct_answers_count,
                'total_answers': total_answers_count,
                'accuracy_rate': accuracy_rate,
                'joined_at': participant.joined_at.isoformat()
            })

        return leaderboard

    except Exception as e:
        logger.error(f"خطا در تولید لیدربرد: {e}")
        return []


def get_correct_answer_data(slide):
    """
    دریافت اطلاعات پاسخ صحیح برای نمایش پس از پایان سوال

    Args:
        slide: شیء اسلاید

    Returns:
        dict or None: اطلاعات پاسخ صحیح
    """
    try:
        if slide.slide_type in ['multiple_choice', 'true_false']:
            correct_options = slide.options.filter(is_correct=True)
            return {
                'correct_options': [
                    {
                        'id': str(opt.id),
                        'text': opt.text,
                        'image_url': opt.image.url if opt.image else None
                    }
                    for opt in correct_options
                ],
                'explanation': getattr(slide, 'explanation', '')
            }
        return None
    except Exception as e:
        logger.error(f"خطا در دریافت اطلاعات پاسخ صحیح: {e}")
        return None


def calculate_question_analytics(session, slide):
    """
    محاسبه آمار و آنالیتیکس برای یک سوال خاص

    Args:
        session: شیء جلسه
        slide: شیء اسلاید

    Returns:
        dict: آمار سوال
    """
    try:
        answers = ParticipantAnswer.objects.filter(
            session=session,
            slide=slide
        )

        total_answers = answers.count()
        correct_answers = answers.filter(is_correct=True).count()
        incorrect_answers = answers.filter(is_correct=False).count()

        # محاسبه زمان متوسط پاسخ
        avg_time_result = answers.aggregate(
            avg_time=models.Avg('response_time'))
        average_time = avg_time_result['avg_time'] or 0

        # محاسبه درصد پاسخ‌های صحیح
        correct_percentage = 0
        if total_answers > 0:
            correct_percentage = round(
                (correct_answers / total_answers) * 100, 1)

        # محاسبه نرخ مشارکت
        participation_rate = 0
        if session.participant_count > 0:
            participation_rate = round(
                (total_answers / session.participant_count) * 100, 1)

        # توزیع گزینه‌ها برای سوالات چندگزینه‌ای
        option_distribution = {}
        if slide.slide_type in ['multiple_choice', 'true_false']:
            for option in slide.options.all():
                option_count = answers.filter(selected_option=option).count()
                option_percentage = 0
                if total_answers > 0:
                    option_percentage = round(
                        (option_count / total_answers) * 100, 1)

                option_distribution[str(option.id)] = {
                    'text': option.text,
                    'count': option_count,
                    'percentage': option_percentage,
                    'is_correct': option.is_correct
                }

        return {
            'slide_id': str(slide.id),
            'slide_title': slide.title,
            'slide_type': slide.slide_type,
            'total_answers': total_answers,
            'correct_answers': correct_answers,
            'incorrect_answers': incorrect_answers,
            'correct_percentage': correct_percentage,
            'average_time': round(average_time, 2),
            'participation_rate': participation_rate,
            'option_distribution': option_distribution
        }

    except Exception as e:
        logger.error(f"خطا در محاسبه آمار سوال: {e}")
        return {}


def calculate_quiz_analytics(session):
    """
    محاسبه آمار کلی برای کل کوییز

    Args:
        session: شیء جلسه

    Returns:
        dict: آمار کلی کوییز
    """
    try:
        quiz = session.quiz
        slides = quiz.slides.filter(is_active=True)
        question_slides = slides.exclude(
            slide_type__in=['slide', 'leaderboard'])

        # محاسبه امتیاز کل همه شرکت‌کنندگان
        total_score = Participant.objects.filter(quiz=quiz).aggregate(
            total=models.Sum('total_score')
        )['total'] or 0

        # محاسبه میانگین امتیاز
        participant_count = session.participant_count
        average_score = round(total_score / participant_count,
                              1) if participant_count > 0 else 0

        # محاسبه نرخ دقت کلی
        total_answers = ParticipantAnswer.objects.filter(
            session=session).count()
        total_correct_answers = ParticipantAnswer.objects.filter(
            session=session, is_correct=True
        ).count()

        overall_accuracy = 0
        if total_answers > 0:
            overall_accuracy = round(
                (total_correct_answers / total_answers) * 100, 1)

        # محاسبه زمان متوسط پاسخ برای کل کوییز
        avg_response_time = ParticipantAnswer.objects.filter(
            session=session
        ).aggregate(avg_time=models.Avg('response_time'))['avg_time'] or 0

        # پیدا کردن سوالات سخت و آسان
        question_difficulty = []
        for slide in question_slides:
            analytics = calculate_question_analytics(session, slide)
            if analytics:
                question_difficulty.append({
                    'slide_id': str(slide.id),
                    'slide_title': slide.title,
                    'correct_percentage': analytics['correct_percentage'],
                    'difficulty': get_difficulty_level(analytics['correct_percentage'])
                })

        # مرتب کردن بر اساس سختی
        question_difficulty.sort(key=lambda x: x['correct_percentage'])

        return {
            'quiz_id': str(quiz.id),
            'quiz_title': quiz.title,
            'session_id': str(session.id),
            'session_code': session.code,
            'total_questions': question_slides.count(),
            'total_participants': participant_count,
            'total_score_all_participants': total_score,
            'average_score': average_score,
            'total_answers': total_answers,
            'total_correct_answers': total_correct_answers,
            'overall_accuracy': overall_accuracy,
            'average_response_time': round(avg_response_time, 2),
            'quiz_duration': calculate_quiz_duration(session),
            'completion_rate': calculate_completion_rate(session),
            'question_difficulty': question_difficulty,
            'started_at': session.started_at.isoformat(),
            'finished_at': session.finished_at.isoformat() if session.finished_at else None
        }

    except Exception as e:
        logger.error(f"خطا در محاسبه آمار کلی کوییز: {e}")
        return {}


def get_difficulty_level(correct_percentage):
    """
    تعیین سطح سختی سوال بر اساس درصد پاسخ‌های صحیح

    Args:
        correct_percentage: درصد پاسخ‌های صحیح

    Returns:
        str: سطح سختی
    """
    if correct_percentage >= 80:
        return 'آسان'
    elif correct_percentage >= 60:
        return 'متوسط'
    elif correct_percentage >= 40:
        return 'سخت'
    else:
        return 'خیلی سخت'


def calculate_quiz_duration(session):
    """
    محاسبه مدت زمان کل کوییز

    Args:
        session: شیء جلسه

    Returns:
        float: مدت زمان به ثانیه
    """
    if session.finished_at and session.started_at:
        duration = session.finished_at - session.started_at
        return duration.total_seconds()
    elif session.started_at:
        return (timezone.now() - session.started_at).total_seconds()
    return 0


def calculate_completion_rate(session):
    """
    محاسبه نرخ تکمیل کوییز

    Args:
        session: شیء جلسه

    Returns:
        float: نرخ تکمیل به درصد
    """
    try:
        total_slides = session.quiz.slides.filter(is_active=True).count()
        if total_slides == 0:
            return 0

        # میانگین تعداد پاسخ‌های داده شده توسط شرکت‌کنندگان
        participant_count = session.participant_count
        if participant_count == 0:
            return 0

        total_answers = ParticipantAnswer.objects.filter(
            session=session).count()
        avg_answers = total_answers / participant_count

        completion_rate = (avg_answers / total_slides) * 100
        return round(min(completion_rate, 100), 1)

    except Exception as e:
        logger.error(f"خطا در محاسبه نرخ تکمیل: {e}")
        return 0


def can_start_quiz(user, quiz):
    """
    بررسی آیا کاربر مجوز شروع کوییز را دارد

    Args:
        user: کاربر
        quiz: کوییز

    Returns:
        bool: آیا می‌تواند شروع کند
    """
    if not user.is_authenticated:
        return False

    # مالک همیشه می‌تواند شروع کند
    if quiz.owner == user:
        return True

    try:
        # بررسی دسترسی مدیر
        from .models import QuizManager
        manager = QuizManager.objects.filter(quiz=quiz, user=user).first()
        return manager and manager.can_start_session
    except Exception as e:
        logger.error(f"خطا در بررسی مجوز شروع کوییز: {e}")
        return False


def can_control_session(user, session):
    """
    بررسی آیا کاربر مجوز کنترل جلسه را دارد

    Args:
        user: کاربر
        session: جلسه

    Returns:
        bool: آیا می‌تواند کنترل کند
    """
    if not user.is_authenticated:
        return False

    # مالک همیشه می‌تواند کنترل کند
    if session.quiz.owner == user:
        return True

    try:
        # بررسی دسترسی مدیر
        from .models import QuizManager
        manager = QuizManager.objects.filter(
            quiz=session.quiz, user=user).first()
        return manager and manager.can_start_session
    except Exception as e:
        logger.error(f"خطا در بررسی مجوز کنترل جلسه: {e}")
        return False


def get_next_slide(session):
    """
    پیدا کردن اسلاید بعدی

    Args:
        session: شیء جلسه

    Returns:
        Slide or None: اسلاید بعدی
    """
    try:
        if not session.current_slide:
            # اگر اسلاید جاری وجود ندارد، اولین اسلاید فعال را برمی‌گردانیم
            return session.quiz.slides.filter(is_active=True).order_by('order').first()

        # پیدا کردن اسلاید بعدی بر اساس ترتیب
        next_slide = session.quiz.slides.filter(
            order__gt=session.current_slide.order,
            is_active=True
        ).order_by('order').first()

        return next_slide

    except Exception as e:
        logger.error(f"خطا در پیدا کردن اسلاید بعدی: {e}")
        return None


def validate_participant_data(participant_data):
    """
    اعتبارسنجی داده‌های شرکت‌کننده

    Args:
        participant_data: دیکشنری حاوی داده‌های شرکت‌کننده

    Returns:
        list: لیست خطاها (خالی اگر معتبر باشد)
    """
    errors = []

    full_name = participant_data.get('full_name', '').strip()
    if not full_name:
        errors.append('نام و نام خانوادگی الزامی است')
    elif len(full_name) < 2:
        errors.append('نام و نام خانوادگی باید حداقل ۲ کاراکتر باشد')
    elif len(full_name) > 100:
        errors.append('نام و نام خانوادگی نباید بیشتر از ۱۰۰ کاراکتر باشد')

    avatar = participant_data.get('avatar', '').strip()
    if not avatar:
        errors.append('انتخاب آواتار الزامی است')
    elif len(avatar) > 50:
        errors.append('آواتار نباید بیشتر از ۵۰ کاراکتر باشد')

    return errors


def handle_unanswered_questions(session, slide):
    """
    مدیریت شرکت‌کنندگانی که به سوال پاسخ نداده‌اند

    Args:
        session: شیء جلسه
        slide: شیء اسلاید

    Returns:
        int: تعداد پاسخ‌های داده نشده که مدیریت شدند
    """
    try:
        # شرکت‌کنندگانی که به این سوال پاسخ داده‌اند
        answered_participants = ParticipantAnswer.objects.filter(
            session=session,
            slide=slide
        ).values_list('participant_id', flat=True)

        # شرکت‌کنندگانی که پاسخ نداده‌اند
        unanswered_participants = Participant.objects.filter(
            quiz=session.quiz
        ).exclude(id__in=answered_participants)

        # ایجاد رکورد برای پاسخ‌های داده نشده
        unanswered_answers = []
        for participant in unanswered_participants:
            unanswered_answers.append(
                ParticipantAnswer(
                    participant=participant,
                    slide=slide,
                    session=session,
                    is_correct=False,
                    points_earned=0,
                    response_time=0
                )
            )

        if unanswered_answers:
            ParticipantAnswer.objects.bulk_create(unanswered_answers)
            logger.info(
                f"{len(unanswered_answers)} پاسخ داده نشده برای اسلاید {slide.id} ایجاد شد")

        return len(unanswered_answers)

    except Exception as e:
        logger.error(f"خطا در مدیریت پاسخ‌های داده نشده: {e}")
        return 0


def save_leaderboard_snapshot(session, slide):
    """
    ذخیره اسنپ‌شات از لیدربرد فعلی

    Args:
        session: شیء جلسه
        slide: شیء اسلاید

    Returns:
        LeaderboardSnapshot: شیء اسنپ‌شات ذخیره شده
    """
    try:
        leaderboard_data = generate_leaderboard_data(session)
        snapshot = LeaderboardSnapshot.objects.create(
            session=session,
            slide=slide,
            snapshot_data=leaderboard_data
        )
        logger.info(f"اسنپ‌شات لیدربرد برای اسلاید {slide.id} ذخیره شد")
        return snapshot
    except Exception as e:
        logger.error(f"خطا در ذخیره اسنپ‌شات لیدربرد: {e}")
        return None


def get_session_by_code(session_code):
    """
    پیدا کردن جلسه بر اساس کد

    Args:
        session_code: کد جلسه

    Returns:
        QuizSession or None: شیء جلسه
    """
    try:
        return QuizSession.objects.get(code=session_code)
    except QuizSession.DoesNotExist:
        logger.warning(f"جلسه با کد {session_code} پیدا نشد")
        return None
    except Exception as e:
        logger.error(f"خطا در پیدا کردن جلسه: {e}")
        return None


def is_question_active(session, slide):
    """
    بررسی آیا سوال هنوز فعال است

    Args:
        session: شیء جلسه
        slide: شیء اسلاید

    Returns:
        bool: آیا سوال فعال است
    """
    if session.status != 'active':
        return False

    if session.current_slide != slide:
        return False

    return True


def calculate_streak_bonus(current_streak):
    """
    محاسبه پاداش استریک برای پاسخ‌های صحیح متوالی

    Args:
        current_streak: تعداد پاسخ‌های صحیح متوالی

    Returns:
        int: پاداش استریک
    """
    if current_streak >= 5:
        return 10  # پاداش برای ۵ پاسخ صحیح متوالی
    elif current_streak >= 3:
        return 5   # پاداش برای ۳ پاسخ صحیح متوالی
    return 0


def validate_quiz_settings(settings):
    """
    اعتبارسنجی تنظیمات کوییز

    Args:
        settings: دیکشنری تنظیمات

    Returns:
        list: لیست خطاها
    """
    errors = []

    # اعتبارسنجی تنظیمات اختیاری
    if 'show_leaderboard_after_each' in settings and not isinstance(settings['show_leaderboard_after_each'], bool):
        errors.append('show_leaderboard_after_each باید true یا false باشد')

    if 'randomize_questions' in settings and not isinstance(settings['randomize_questions'], bool):
        errors.append('randomize_questions باید true یا false باشد')

    if 'show_correct_answers' in settings and not isinstance(settings['show_correct_answers'], bool):
        errors.append('show_correct_answers باید true یا false باشد')

    if 'max_participants' in settings:
        try:
            max_participants = int(settings['max_participants'])
            if max_participants < 1:
                errors.append('max_participants باید عددی مثبت باشد')
        except (ValueError, TypeError):
            errors.append('max_participants باید عدد باشد')

    return errors

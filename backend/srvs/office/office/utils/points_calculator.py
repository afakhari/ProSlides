import math


class PointsCalculator:
    @staticmethod
    def calculate(question, submit_time, is_correct, calculation_method):
        """
        محاسبه امتیاز با در نظر گرفتن تمام edge cases
        """
        if not is_correct:
            return 0

        # محاسبه نسبت زمان
        time_limit = question.get_actual_time_limit()
        if time_limit <= 0:
            time_limit = 30  # مقدار پیش‌فرض

        time_ratio = min(submit_time / time_limit, 1.0)  # محدود به 100%

        if calculation_method == 'fixed':
            return PointsCalculator._calculate_fixed(question)

        elif calculation_method == 'accuracy_based':
            return PointsCalculator._calculate_accuracy_based(question, time_ratio)

        elif calculation_method == 'time_based':
            return PointsCalculator._calculate_time_based(question, time_ratio)

        return question.min_points

    @staticmethod
    def _calculate_fixed(question):
        """امتیاز ثابت - میانگین min و max"""
        return math.floor((question.min_points + question.max_points) / 2)

    @staticmethod
    def _calculate_accuracy_based(question, time_ratio):
        """امتیاز بر اساس دقت - زمان تأثیر کم"""
        base_points = question.max_points
        # زمان فقط 20% تأثیر دارد و به صورت نمایی کاهش می‌یابد
        time_penalty = math.pow(time_ratio, 2) * 0.2
        points = base_points * (1 - time_penalty)
        return max(question.min_points, math.floor(points))

    @staticmethod
    def _calculate_time_based(question, time_ratio):
        """امتیاز بر اساس زمان - زمان تأثیر زیاد"""
        base_points = question.max_points
        # زمان به صورت خطی تأثیر دارد
        points = base_points * (1 - time_ratio)
        return max(question.min_points, math.floor(points))

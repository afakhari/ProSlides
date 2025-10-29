from rest_framework import serializers
from django.core.exceptions import ValidationError
from .models import Quiz, PickAnswerQuestion, Option


class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ['id', 'text', 'is_correct']


class PickAnswerQuestionSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True)

    class Meta:
        model = PickAnswerQuestion
        fields = ['id', 'quiz', 'title', 'order', 'question_text', 'options']

    def validate_order(self, value):
        """اعتبارسنجی order در سطح سریالایزر"""
        if value <= 0:
            raise serializers.ValidationError(
                "Order must be greater than zero.")
        return value

    def validate(self, data):
        """اعتبارسنجی یکتایی order در کوئیز"""
        quiz = data.get('quiz') or (
            self.instance.quiz if self.instance else None)
        order = data.get('order')

        if quiz and order:
            # بررسی وجود سوال با order تکراری
            existing = PickAnswerQuestion.objects.filter(
                quiz=quiz,
                order=order
            )

            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)

            if existing.exists():
                raise serializers.ValidationError({
                    'order': f'A question with order {order} already exists in this quiz.'
                })

        return data

    def update(self, instance, validated_data):
        options_data = validated_data.pop('options', [])

        instance.title = validated_data.get('title', instance.title)
        instance.question_text = validated_data.get(
            'question_text', instance.question_text)
        instance.order = validated_data.get('order', instance.order)

        try:
            instance.full_clean()  # اعتبارسنجی مدل
            instance.save()
        except ValidationError as e:
            raise serializers.ValidationError(e.message_dict)

        self._update_options(instance, options_data)
        return instance

    def create(self, validated_data):
        options_data = validated_data.pop('options', [])

        try:
            question = PickAnswerQuestion(**validated_data)
            question.full_clean()  # اعتبارسنجی قبل از ذخیره
            question.save()
        except ValidationError as e:
            raise serializers.ValidationError(e.message_dict)

        for option_data in options_data:
            Option.objects.create(question=question, **option_data)

        return question

    def _update_options(self, question, options_data):
        existing_options = {opt.id: opt for opt in question.options.all()}

        for option_data in options_data:
            option_id = option_data.get('id')

            if option_id and option_id in existing_options:
                option = existing_options[option_id]
                for attr, value in option_data.items():
                    setattr(option, attr, value)
                option.save()
                del existing_options[option_id]
            else:
                Option.objects.create(question=question, **option_data)

        for option in existing_options.values():
            option.delete()


class PickAnswerQuestionCreateSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True, required=False)

    class Meta:
        model = PickAnswerQuestion
        fields = ['id', 'title', 'order', 'question_text', 'options']

    def validate_order(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Order must be greater than zero.")
        return value


class QuizDetailSerializer(serializers.ModelSerializer):
    slides = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = ['id', 'title', 'created_by', 'created_at', 'slides']

    def get_slides(self, obj):
        questions = PickAnswerQuestion.objects.filter(quiz=obj)
        return PickAnswerQuestionSerializer(questions, many=True).data


class QuizSerializer(serializers.ModelSerializer):
    slides_count = serializers.IntegerField(
        source='slides.count', read_only=True)

    class Meta:
        model = Quiz
        fields = ['id', 'title', 'created_by', 'created_at', 'slides_count']

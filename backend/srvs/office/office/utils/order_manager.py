from django.db import models


class OrderManager:
    @staticmethod
    def shift_orders(queryset, from_order, shift_amount=1):
        """بهینه‌سازی جابجایی ترتیب با یک query"""
        if shift_amount > 0:
            # افزایش ترتیب
            queryset.filter(order__gte=from_order).update(
                order=models.F('order') + shift_amount
            )
        else:
            # کاهش ترتیب
            queryset.filter(order__gte=from_order).update(
                order=models.F('order') - abs(shift_amount)
            )

    @staticmethod
    def get_next_order(queryset):
        """دریافت ترتیب بعدی"""
        last_order = queryset.aggregate(models.Max('order'))['order__max']
        return (last_order or 0) + 1

    @staticmethod
    def reorder_items(model_class, parent_field, parent_id, new_order):
        """سفارشی‌سازی ترتیب آیتم‌ها"""
        items = model_class.objects.filter(**{parent_field: parent_id})
        existing_ids = set(items.values_list('id', flat=True))

        if set(new_order) != existing_ids:
            raise ValueError("لیست ترتیب باید شامل تمام IDهای موجود باشد")

        for order, item_id in enumerate(new_order, 1):
            model_class.objects.filter(id=item_id).update(order=order)

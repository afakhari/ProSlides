import os
import sys

if __name__ == "__main__":
    # اضافه کردن مسیر پروژه به Python path
    sys.path.append(os.path.dirname(os.path.dirname(
        os.path.dirname(os.path.abspath(__file__)))))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'office.settings')

    # حالا django را import کنیم
    import django
    django.setup()

    from create_sample_data import create_sample_data, clear_sample_data

    print("🎯 مدیریت داده‌های نمونه ProSlides")
    print("=" * 40)
    print("1. ایجاد داده‌های نمونه")
    print("2. پاک کردن داده‌های نمونه")
    print("3. خروج")

    choice = input("\nلطفاً گزینه مورد نظر را انتخاب کنید (1-3): ")

    if choice == '1':
        create_sample_data()
    elif choice == '2':
        clear_sample_data()
    elif choice == '3':
        print("👋 خدانگهدار!")
    else:
        print("❌ گزینه نامعتبر!")

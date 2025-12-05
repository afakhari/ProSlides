from drf_yasg import openapi

swagger_info = openapi.Info(
    title="ProSlides API",
    default_version="v1",
    description="""
# ProSlides API Docs

مدیریت کوییز شبیه AhaSlides/Kahoot:
- مالک‌ها با JWT لاگین می‌کنند و فقط روی کوییزهای خودشان CRUD دارند.
- شرکت‌کننده‌ها بدون لاگین فقط از مسیرهای عمومی استفاده می‌کنند (جلسه بازیکن، لیدربورد).

## معماری
- Django REST Framework (CRUD داده)
- SimpleJWT (Bearer Token)
- انتشار کوییز به WebSocket (Rust) و UI

## احراز هویت
- `POST /api/auth/register/` ثبت‌نام مالک
- `POST /api/auth/token/` دریافت Access/Refresh
- هدر: `Authorization: Bearer <access>`

## دسترسی‌ها
- CRUD کوییز/اسلاید/سؤال/گزینه فقط برای owner
- مسیرهای عمومی: `leaderboard receive` و `player-sessions` بدون توکن
- `export` نیاز به توکن مالک دارد.

## جریان نمونه
1) Register → Token → ساخت کوییز و اسلاید
2) Export برای اجرای WebSocket
3) بازیکنان نتایج را از endpoint عمومی ارسال می‌کنند
""",
    contact=openapi.Contact(name="ProSlides Team", email="support@proslides.com"),
    license=openapi.License(name="MIT License"),
)

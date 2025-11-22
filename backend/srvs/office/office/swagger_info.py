from drf_yasg import openapi

swagger_info = openapi.Info(
    title="ProSlides API",
    default_version='v1',
    description="""
    # 🎯 ProSlides API Documentation
    
    ## 📖 Overview
    ProSlides یک پلتفرم ایجاد و اجرای کوئیزهای تعاملی شبیه به Kahoot و AhaSlides است.
    
    ## 🔗 Architecture
    - **Django REST Framework**: مدیریت داده‌ها و API
    - **Rust WebSocket**: مدیریت real-time اجرای کوئیز
    - **React Frontend**: رابط کاربری
    
    ## 🚀 Quick Start
    
    1. **Create Quiz**: ایجاد کوئیز جدید
    2. **Add Slides**: اضافه کردن اسلایدهای سوال و محتوا
    3. **Add Questions & Options**: ایجاد سوالات و گزینه‌ها
    4. **Export to Rust**: صادرات کوئیز برای اجرا
    5. **Run Quiz**: اجرای کوئیز از طریق WebSocket
    
    ## 📊 Flow
    ```
    Django (Data) → Rust (WebSocket) → Frontend (UI)
    ```
    
    ## 🔐 Authentication
    در حال حاضر سیستم احراز هویت پیاده‌سازی نشده است.
    """,
    contact=openapi.Contact(
        name="ProSlides Team",
        email="support@proslides.com"
    ),
    license=openapi.License(name="MIT License"),
)

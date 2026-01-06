import { Link } from "react-router-dom";

function LogoMark() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-1.5 text-[#111827] font-semibold text-lg before:content-['✱'] before:text-xl"
    >
      ProSlides
    </Link>
  );
}

export default function SiteFooter({ className = "" }) {
  const footerClassName = ["border-t border-[#e5e7eb] bg-white", className]
    .filter(Boolean)
    .join(" ");

  return (
    <footer className={footerClassName} dir="rtl">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[1.2fr_2.8fr]">
          <div className="text-left">
            <LogoMark />
            <p className="mt-2 text-sm text-[#94a3b8]">
              The power of engagement
            </p>
          </div>
          <div className="grid gap-8 text-sm text-[#6b7280] sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#111827]">
                ویژگی‌ها
              </h3>
              <ul className="mt-4 space-y-3">
                <li>آزمون ها</li>
                <li>کنترل از راه دور</li>
                <li>ارایه های پیشرفته</li>
                <li>پرسش و پاسخ</li>
                <li>لیدر بورد</li>
                <li>آنالیز امتیازات</li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#111827]">
                کاربردها
              </h3>
              <ul className="mt-4 space-y-3">
                <li>دانشگاه</li>
                <li>مدارس</li>
                <li>مراکز آموزشی</li>
                <li>شرکت ها</li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#111827]">
                قیمت‌گذاری
              </h3>
              <ul className="mt-4 space-y-3">
                <li>برنامه ها</li>
                <li>اشتراک ها</li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#111827]">
                تیم ما
              </h3>
              <ul className="mt-4 space-y-3">
                <li>درباره ما</li>
                <li>ارتباط با ما</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

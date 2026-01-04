import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Seo from "../../components/Seo";
import SiteHeader from "../../components/SiteHeader";
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


export default function LandingPage() {
  const navigate = useNavigate();
  const [accessCode, setAccessCode] = useState("");

  const handleJoin = (event) => {
    event.preventDefault();
    const trimmed = accessCode.trim();
    if (!trimmed) return;
    navigate(`/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div
      className="min-h-screen text-[#111827]"
      dir="rtl"
      style={{
        fontFamily: '"Vazirmatn", "Outfit", "Segoe UI", sans-serif',
        background:
          "radial-gradient(circle at 10% 15%, rgba(236, 253, 245, 0.7) 0%, transparent 55%), radial-gradient(circle at 90% 10%, rgba(239, 246, 255, 0.7) 0%, transparent 50%), linear-gradient(180deg, #ffffff 0%, #f7fafc 100%)",
      }}
    >
      <Seo
        title="پرو اسلایدز | ارائه‌های تعاملی و حرفه‌ای"
        description="پرو اسلایدز پلتفرم ایرانی ارائه‌های تعاملی است؛ نظرسنجی زنده، کوییز، و اسلایدهای مشارکتی برای کلاس‌ها و تیم‌ها."
        canonical="https://proslides.ir/"
      />
      <div className="border-b border-[#e5e7eb] bg-[#f8fafc]">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 py-2 text-sm text-[#1f2937]">
          <span className="text-[#374151]">شرکت‌کننده هستید؟ کد ورود را وارد کنید.</span>
          <form
            onSubmit={handleJoin}
            className="flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 shadow-[0_6px_14px_rgba(15,23,42,0.05)]"
          >
            <span className="pl-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9ca3af]">
              proslides/
            </span>
            <input
              type="text"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              placeholder="کد را وارد کنید"
              className="w-24 border-none bg-transparent text-sm text-[#111827] placeholder:text-[#94a3b8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b2ecf]/30"
              autoComplete="off"
              spellCheck="false"
              aria-label="کد ورود"
              dir="ltr"
            />
            <button
              type="submit"
              className="rounded-full bg-[#111827] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#0f172a]"
            >
              ورود
            </button>
          </form>
        </div>
      </div>

      <SiteHeader />

      <main className="mx-auto flex max-w-5xl flex-col items-center px-6 pb-28 pt-20 text-center">
        <h1 className="text-4xl font-semibold leading-tight text-[#111827] md:text-6xl">
          <span className="block">پلتفرم همه‌کاره برای ارائه‌های</span>
          <span className="block">
            <span className="multi-text" data-longest="اثرگذار">
              <span className="status">تعاملی</span>
              <span className="status">جذاب</span>
              <span className="status">اثرگذار</span>
            </span>{" "}
            و حرفه‌ای
          </span>
        </h1>
        <p className="mt-4 max-w-2xl text-base text-[#6b7280] md:text-lg">
          با اسلایدهای زنده و ابزارهای مشارکتی، تعامل را بالا ببرید و ارائه‌ای
          شفاف، منسجم و تاثیرگذار بسازید.
        </p>
        <button
          type="button"
          onClick={() => navigate("/signup")}
          className="mt-8 rounded-2xl bg-[#5b2ecf] px-8 py-3 text-base font-semibold text-white shadow-[0_18px_40px_rgba(91,46,207,0.3)] transition hover:bg-[#4b25b1]"
        >
          رایگان شروع کنید
        </button>
      </main>
    </div>
  );
}


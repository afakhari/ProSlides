import { useState } from "react";
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

export default function SiteHeader({ className = "" }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const headerClassName = ["border-b border-[#e5e7eb] bg-white", className]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={headerClassName}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-4">
        <div className="flex items-center gap-2">
          <LogoMark />
        </div>
        <nav
          className="hidden items-center gap-6 text-sm font-semibold text-[#6b7280] md:flex"
          aria-label="ناوبری"
        />
        <div className="flex items-center gap-2 text-xs font-semibold sm:gap-3 sm:text-sm">
          <Link
            to="/login"
            className="rounded-xl border border-[#e5e7eb] bg-white px-3 py-1.5 text-[#111827] transition hover:border-[#cbd5f5] sm:px-4 sm:py-2"
          >
            ورود
          </Link>
          <Link
            to="/signup"
            className="rounded-xl bg-[#5b2ecf] px-3 py-1.5 text-white shadow-[0_12px_28px_rgba(91,46,207,0.25)] transition hover:bg-[#4b25b1] sm:px-4 sm:py-2"
          >
            ثبت‌نام رایگان
          </Link>
        </div>
      </div>
    </header>
  );
}

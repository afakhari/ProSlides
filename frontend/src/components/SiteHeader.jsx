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
  const headerClassName = ["border-b border-[#e5e7eb] bg-white", className]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={headerClassName}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-4">
        <LogoMark />
        <nav className="hidden items-center gap-6 text-sm font-semibold text-[#6b7280] md:flex">
          <span className="flex items-center gap-2 text-[#94a3b8]">
            Features
            <span className="rounded-full bg-[#eef2f7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
              Soon
            </span>
          </span>
          <span className="flex items-center gap-2 text-[#94a3b8]">
            Use cases
            <span className="rounded-full bg-[#eef2f7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
              Soon
            </span>
          </span>
          <span className="flex items-center gap-2 text-[#94a3b8]">
            Pricing
            <span className="rounded-full bg-[#eef2f7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
              Soon
            </span>
          </span>
          <Link to="/team" className="transition hover:text-[#111827]">
            Meet the team
          </Link>
        </nav>
        <div className="flex items-center gap-3 text-sm font-semibold">
          <Link
            to="/login"
            className="rounded-xl border border-[#e5e7eb] bg-white px-4 py-2 text-[#111827] transition hover:border-[#cbd5f5]"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="rounded-xl bg-[#5b2ecf] px-4 py-2 text-white shadow-[0_12px_28px_rgba(91,46,207,0.25)] transition hover:bg-[#4b25b1]"
          >
            Free sign up
          </Link>
        </div>
      </div>
    </header>
  );
}



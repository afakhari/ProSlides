import SiteHeader from "../../components/SiteHeader";
import Seo from "../../components/Seo";
import dotGrid from "../../assets/patterns/dot-grid.svg";
import amiraliFakhari from "../../assets/avatars/AmiraliFakhari.jpg";
import aminBidad from "../../assets/avatars/AminBidad.jpg";
import alirezaRezaei from "../../assets/avatars/AlirezaRezaei.jpg";
import kianJanbozorgi from "../../assets/avatars/KianJanbozorgi.jpg";
import ZahraKefayati from "../../assets/avatars/ZahraKefayati.jpg";
import HesamAzmoun from "../../assets/avatars/HesamAzmoun.jpg";
import SimaKazemi from "../../assets/avatars/SimaKazemi.jpg";

const backendTheme = {
  cover: "#E9F1FB",
  ring: "#83A9D8",
  badgeBg: "#DFE9F9",
  badgeText: "#2E476B",
  glow: "#F4F7FD",
};

const frontendTheme = {
  cover: "#EAF6F3",
  ring: "#7CB9B2",
  badgeBg: "#E1F1EE",
  badgeText: "#1E564F",
  glow: "#F2FBF9",
};

const backendTeam = [
  {
    name: "Amin Bidad",
    role: "مهندس بک‌اند — Rust",
    description: "روی پایداری و سرعت سرویس‌های بلادرنگ تمرکز دارد تا تجربه زنده بدون وقفه بماند.",
    avatar: aminBidad,
    theme: backendTheme,
  },
  {
    name: "Amirali Fakahri",
    role: "مهندس بک‌اند — Django",
    description: "ساختار داده و کنترل دسترسی را طوری نگه می‌دارد که تجربه کاربر قابل اتکا باشد.",
    avatar: amiraliFakhari,
    theme: backendTheme,
  },
];

const frontendTeam = [
  {
    name: "Alireza Reazaei",
    role: "مهندس فرانت‌اند — React",
    description: "یکپارچگی طراحی را حفظ می‌کند و رشد محصول را بی‌نقص جلو می‌برد.",
    avatar: alirezaRezaei,
    theme: frontendTheme,
  },
  {
    name: "Hesam Azmoun",
    role: "مهندس فرانت‌اند — React",
    description: "هدف محصول را به تعامل‌های ساده و روان تبدیل می‌کند.",
    avatar: HesamAzmoun,
    theme: frontendTheme,
  },
  {
    name: "Kian Janbozorgi",
    role: "مهندس فرانت‌اند — React",
    description: "مسیرهای پیچیده را به تجربه‌ای واضح و قابل استفاده تبدیل می‌کند.",
    avatar: kianJanbozorgi,
    theme: frontendTheme,
  },
  {
    name: "Sima Kazemi",
    role: "مهندس فرانت‌اند — React",
    description: "روی عملکرد و رندر روان در ارائه‌های سنگین کار می‌کند.",
    avatar: SimaKazemi,
    theme: frontendTheme,
  },
  {
    name: "Zahra Kefayati",
    role: "مهندس فرانت‌اند — React",
    description: "به جزئیات دسترس‌پذیری و نظم بصری توجه ویژه دارد.",
    avatar: ZahraKefayati,
    theme: frontendTheme,
  },
];

function TeamSection({ id, title, description, members, gridClassName }) {
  return (
    <section aria-labelledby={id} className="space-y-8">
      <div className="space-y-2">
        <h2 id={id} className="text-2xl font-semibold text-slate-900">
          {title}
        </h2>
        <p className="max-w-2xl text-sm text-slate-600">{description}</p>
      </div>
      <ul className={gridClassName}>
        {members.map((member) => {
          const coverStyle = { backgroundColor: member.theme.cover };
          const ringStyle = { backgroundColor: member.theme.ring };
          const badgeStyle = {
            backgroundColor: member.theme.badgeBg,
            color: member.theme.badgeText,
          };
          const glowStyle = { backgroundColor: member.theme.glow };

          return (
            <li key={member.name}>
              <article className="group relative flex h-full min-h-[340px] flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 text-center shadow-[0_12px_32px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(15,23,42,0.12)]">
                <div
                  className="pointer-events-none absolute inset-0 z-0 opacity-0 transition duration-300 group-hover:opacity-60"
                  style={glowStyle}
                />
                <div className="relative z-10 h-28 w-full overflow-hidden">
                  <div className="absolute inset-0" style={coverStyle} />
                  <div className="absolute -top-10 left-6 h-20 w-20 rounded-full bg-white/50 blur-2xl" />
                  <div className="absolute -bottom-10 right-6 h-24 w-24 rounded-full bg-white/40 blur-2xl" />
                </div>
                <div className="relative z-10 flex flex-1 flex-col items-center px-6 pb-8">
                  <div className="-mt-10 rounded-full bg-white p-1 shadow-[0_8px_20px_rgba(15,23,42,0.18)]">
                    <div className="rounded-full p-[3px]" style={ringStyle}>
                      <div className="rounded-full bg-white p-[3px]">
                        <img
                          src={member.avatar}
                          alt={`تصویر ${member.name}`}
                          width="96"
                          height="96"
                          loading="lazy"
                          decoding="async"
                          className="h-24 w-24 rounded-full object-cover"
                        />
                      </div>
                    </div>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">
                    {member.name}
                  </h3>
                  <div className="mt-2">
                    <span
                      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition group-hover:opacity-90"
                      style={badgeStyle}
                    >
                      {member.role}
                    </span>
                  </div>
                  {member.description ? (
                    <p className="mt-3 text-sm text-slate-600">
                      {member.description}
                    </p>
                  ) : null}
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function TeamPage() {
  return (
    <main
      className="relative min-h-screen overflow-x-hidden text-slate-900"
      dir="rtl"
      style={{
        fontFamily: '"Vazirmatn", "Outfit", "Segoe UI", sans-serif',
        backgroundColor: "#f8fafc",
        backgroundImage: `url(${dotGrid})`,
        backgroundSize: "56px 56px",
      }}
    >
      <Seo
        title="تیم ما | پرو اسلایدز"
        description="با تیم کوچکی از مهندسان که تجربه ارائه‌های تعاملی را با دقت و نگاه انسانی می‌سازند آشنا شوید."
        canonical="https://proslides.ir/team"
      />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 -left-24 h-72 w-72 rounded-full bg-sky-100/50 blur-3xl" />
        <div className="absolute top-20 right-[-140px] h-80 w-80 rounded-full bg-rose-100/45 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-emerald-100/45 blur-3xl" />
      </div>
      <SiteHeader className="relative z-10" />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-16 px-6 py-16 sm:py-20">
        <header className="mx-auto max-w-3xl space-y-4 pb-4 text-center">
          <h1 className="text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
            تیم ما
          </h1>
          <p className="text-base text-slate-600 sm:text-lg">
            ما یک تیم کوچک هستیم که با تمرکز بر کیفیت، تجربه‌های تعاملی برای
            ارائه‌ها می‌سازیم.
          </p>
        </header>

        <TeamSection
          id="backend-team"
          title="مهندسی بک‌اند"
          description="زیرساخت‌هایی پایدار و سریع که زیر بار زنده هم مطمئن عمل می‌کنند."
          members={backendTeam}
          gridClassName="grid gap-8 md:grid-cols-2"
        />

        <TeamSection
          id="frontend-team"
          title="مهندسی فرانت‌اند"
          description="رابط کاربری شفاف و روان برای تجربه‌ای که ارائه‌دهنده به آن اعتماد می‌کند."
          members={frontendTeam}
          gridClassName="grid gap-8 md:grid-cols-2 lg:grid-cols-3"
        />
      </div>
    </main>
  );
}

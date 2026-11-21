import {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  BookOpen,
  Menu,
  X,
  Globe2,
  GraduationCap,
  CalendarDays,
  Bell,
  MapPin,
  Phone,
  Mail,
  Download,
  Search,
  ShieldCheck,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Upload,
  ImageIcon,
  Users,
  LayoutDashboard,
  Settings,
  FileText,
  CheckCircle2,
  Eye,
  AlertCircle,
  LoaderCircle,
  Printer,
  Leaf,
  Sparkles,
  LockKeyhole,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import {
  admissionSchema,
  authCaptchaEnabled,
  incomingAuthLinkType,
  abuseFields,
  publicCaptchaRequired,
  contactSchema,
  db,
  localeDate,
  modules,
  publicCall,
  rows,
  safeUrl,
  textOf,
  type Lang,
  type RecordRow,
} from "./lib";

const labels = {
  home: ["প্রচ্ছদ", "Home"],
  about: ["আমাদের সম্পর্কে", "About us"],
  administration: ["প্রশাসন", "Administration"],
  teachers: ["শিক্ষকবৃন্দ", "Teachers"],
  academics: ["শিক্ষা কার্যক্রম", "Academics"],
  admission: ["ভর্তি", "Admission"],
  notices: ["নোটিশ", "Notices"],
  results: ["ফলাফল", "Results"],
  gallery: ["গ্যালারি", "Gallery"],
  news: ["সংবাদ ও অনুষ্ঠান", "News & events"],
  downloads: ["ডাউনলোড", "Downloads"],
  contact: ["যোগাযোগ", "Contact"],
} as const;
type PublicData = {
  settings: RecordRow;
  content: RecordRow[];
  people: RecordRow[];
  notices: RecordRow[];
  events: RecordRow[];
  gallery: RecordRow[];
  academic_documents: RecordRow[];
};
const blank: PublicData = {
  settings: {
    id: "",
    school_name_bn: "[বিদ্যালয়ের নাম]",
    school_name_en: "[School name]",
    tagline_bn: "শিখি আনন্দে, গড়ি আগামী",
    tagline_en: "A happy beginning. A brighter tomorrow.",
  },
  content: [],
  people: [],
  notices: [],
  events: [],
  gallery: [],
  academic_documents: [],
};
const Context = createContext<{
  lang: Lang;
  t: (bn: string, en: string) => string;
  data: PublicData;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
}>({
  lang: "bn",
  t: (b) => b,
  data: blank,
  loading: false,
  error: "",
  reload: async () => {},
});
const useSchool = () => useContext(Context);
function IconBook() {
  const { data, t } = useSchool();
  return (
    <span className="brand-mark">
      {safeUrl(data.settings.logo_url) ? (
        <img
          src={data.settings.logo_url}
          alt={t("বিদ্যালয়ের লোগো", "School logo")}
        />
      ) : (
        <BookOpen size={27} />
      )}
    </span>
  );
}
function Empty({
  bn = "এখনো কোনো তথ্য প্রকাশিত হয়নি।",
  en = "No information has been published yet.",
}: {
  bn?: string;
  en?: string;
}) {
  const { t } = useSchool();
  return (
    <div className="empty">
      <BookOpen size={25} />
      <p>{t(bn, en)}</p>
    </div>
  );
}
function Message({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`message ${error ? "error" : "success"}`}
      role={error ? "alert" : "status"}
    >
      {error ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}
      <span>{children}</span>
    </div>
  );
}
function Spinner() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" /> Loading / লোড হচ্ছে…
    </div>
  );
}
function Photo({
  url,
  alt,
  ...rest
}: {
  url?: string;
  alt: string;
  className?: string;
}) {
  return safeUrl(url) ? (
    <img src={url} alt={alt} loading="lazy" {...rest} />
  ) : (
    <div className={`photo-placeholder ${rest.className || ""}`}>
      <BookOpen size={36} />
      <span>{alt}</span>
    </div>
  );
}

export default function App() {
  const navigate = useNavigate(),
    authLinkHandled = useRef(false);
  useEffect(() => {
    if (!db) return;
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event, session) => {
      if (
        !authLinkHandled.current &&
        (event === "PASSWORD_RECOVERY" ||
          (session && incomingAuthLinkType === "invite"))
      ) {
        authLinkHandled.current = true;
        navigate("/admin/reset-password", { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  const [lang, setLang] = useState<Lang>(() =>
    localStorage.getItem("school-language") === "en" ? "en" : "bn",
  );
  const [data, setData] = useState<PublicData>(blank),
    [loading, setLoading] = useState(!!db),
    [error, setError] = useState("");
  const t = useCallback(
    (bn: string, en: string) => (lang === "bn" ? bn : en),
    [lang],
  );
  const reload = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    setError("");
    try {
      const tables = [
        "settings",
        "content",
        "people",
        "notices",
        "events",
        "gallery",
        "academic_documents",
      ];
      const loaded = await Promise.all(
        tables.map((x) => rows(x, x !== "settings")),
      );
      setData({
        settings: loaded[0][0] || blank.settings,
        content: loaded[1].sort((a, b) => a.sort_order - b.sort_order),
        people: loaded[2],
        notices: loaded[3].sort((a, b) => Number(b.pinned) - Number(a.pinned)),
        events: loaded[4],
        gallery: loaded[5],
        academic_documents: loaded[6],
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
    const focus = () => {
      void reload();
    };
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [reload]);
  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("school-language", lang);
  }, [lang]);
  return (
    <Context.Provider value={{ lang, t, data, loading, error, reload }}>
      <ErrorBoundary>
        <Routes>
          <Route path="/admin/*" element={<AdminShell setLang={setLang} />} />
          <Route path="/*" element={<PublicShell setLang={setLang} />} />
        </Routes>
      </ErrorBoundary>
    </Context.Provider>
  );
}
import { Component } from "react";
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="container section">
        <h1>সাময়িক সমস্যা / Something went wrong</h1>
        <p>
          Please reload the page. Contact the school if the problem continues.
        </p>
        <button onClick={() => location.reload()}>Reload / আবার খুলুন</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function Language({ setLang }: { setLang: (v: Lang) => void }) {
  const { lang } = useSchool();
  return (
    <button
      className="language"
      onClick={() => setLang(lang === "bn" ? "en" : "bn")}
      aria-label="Change language"
    >
      <Globe2 size={17} />
      {lang === "bn" ? "English" : "বাংলা"}
    </button>
  );
}
function PublicShell({ setLang }: { setLang: (v: Lang) => void }) {
  const { lang, t, data, error, reload } = useSchool(),
    [menu, setMenu] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
    const key = location.pathname.split("/")[1] || "home";
    const title =
      labels[key as keyof typeof labels]?.[lang === "bn" ? 0 : 1] ||
      t("পৃষ্ঠা", "Page");
    document.title = `${title} | ${textOf(data.settings, "school_name", lang)}`;
    const description =
      textOf(data.settings, "seo_description", lang) ||
      t("প্রাথমিক বিদ্যালয়ের শিক্ষাসেবা।", "Primary school academic services.");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", description);
    document
      .querySelector('meta[property="og:title"]')
      ?.setAttribute("content", document.title);
    let meta = document.querySelector('meta[property="og:description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("property", "og:description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);
  }, [location.pathname, lang, data.settings, t]);
  const primary = [
    "home",
    "about",
    "academics",
    "notices",
    "gallery",
    "contact",
  ] as const;
  return (
    <>
      <PublicMetadata />
      <a className="skip-link" href="#main">
        {t("মূল বিষয়বস্তুতে যান", "Skip to content")}
      </a>
      <div className="topbar">
        <div className="container">
          <span>
            {t("শিক্ষা · মূল্যবোধ · আগামী", "Learning · Values · Tomorrow")}
          </span>
          <div>
            <Link to="/results">{t("শিক্ষার্থীর ফলাফল", "Student results")}</Link>
            <span className="top-divider" />
            <Link to="/admin/login">
              <LockKeyhole size={13} />
              {t("অ্যাডমিন", "Admin")}
            </Link>
          </div>
        </div>
      </div>
      <header>
        <div className="container header-inner">
          <Link to="/" className="brand">
            <IconBook />
            <span>
              <strong>{textOf(data.settings, "school_name", lang)}</strong>
              <small>
                {t("বেসরকারি প্রাথমিক বিদ্যালয়", "PRIVATE PRIMARY SCHOOL")}
              </small>
            </span>
          </Link>
          <nav
            className={menu ? "nav open" : "nav"}
            aria-label="Main navigation"
          >
            {primary.map((k) => (
              <NavLink
                key={k}
                to={k === "home" ? "/" : `/${k}`}
                end={k === "home"}
              >
                {labels[k][lang === "bn" ? 0 : 1]}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <Language setLang={setLang} />
            <Link className="button small" to="/admission">
              {t("ভর্তি তথ্য", "Admissions")}
            </Link>
            <button
              className="icon-button mobile-menu"
              aria-expanded={menu}
              aria-label={t("মেনু খুলুন", "Open menu")}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      {!db && (
        <div className="setup-strip">
          {t(
            "সেটআপ প্রিভিউ: বিদ্যালয়ের তথ্য ও ডেটাবেস এখনো যুক্ত করা হয়নি।",
            "SETUP PREVIEW · School details and database have not been connected.",
          )}
        </div>
      )}
      {error && (
        <div className="container">
          <Message error>
            {t("তথ্য লোড করা যায়নি।", "Unable to load school information.")}{" "}
            <button className="text-button" onClick={() => void reload()}>
              {t("আবার চেষ্টা", "Retry")}
            </button>
          </Message>
        </div>
      )}
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route
            path="/administration"
            element={<PeoplePage administration />}
          />
          <Route path="/teachers" element={<PeoplePage />} />
          <Route path="/academics" element={<Academics />} />
          <Route path="/admission" element={<Admission />} />
          <Route path="/notices" element={<Notices />} />
          <Route path="/notices/:id" element={<NoticeDetail />} />
          <Route path="/results" element={<Results />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/news" element={<News />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
function PageHead({
  title,
  subtitle,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
}) {
  const { t } = useSchool();
  return (
    <div className="page-head">
      <div className="container">
        <div className="breadcrumb">
          <Link to="/">{t("প্রচ্ছদ", "Home")}</Link>
          <span>/</span>
          <span>{title}</span>
        </div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
}
function PublicMetadata() {
  const { data, lang } = useSchool(),
    route = useLocation();
  useEffect(() => {
    const nodes: HTMLElement[] = [];
    const meta = (property: string, content: string) => {
      if (!content) return;
      const el = document.createElement("meta");
      el.setAttribute("property", property);
      el.content = content;
      document.head.appendChild(el);
      nodes.push(el);
    };
    const canonical = document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = location.origin + route.pathname;
    document.head.appendChild(canonical);
    nodes.push(canonical);
    meta("og:url", canonical.href);
    meta("og:locale", lang === "bn" ? "bn_BD" : "en_GB");
    meta("og:image", safeUrl(data.settings.social_image_url) || "");
    const name = textOf(data.settings, "school_name", lang);
    if (name && !name.startsWith("[")) {
      const json = document.createElement("script");
      json.type = "application/ld+json";
      json.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ElementarySchool",
        name,
        url: location.origin,
        telephone: data.settings.phone || undefined,
        email: data.settings.email || undefined,
        logo: safeUrl(data.settings.logo_url),
      });
      document.head.appendChild(json);
      nodes.push(json);
    }
    return () => nodes.forEach((node) => node.remove());
  }, [data.settings, lang, route.pathname]);
  return null;
}
function SectionTitle({
  bn,
  en,
  sub,
  to,
}: {
  bn: string;
  en: string;
  sub?: string;
  to?: string;
}) {
  const { t } = useSchool();
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">
          {sub || t("একসাথে এগিয়ে চলি", "GROWING TOGETHER")}
        </p>
        <h2>{t(bn, en)}</h2>
      </div>
      {to && (
        <Link className="text-link" to={to}>
          {t("সব দেখুন", "View all")}
        </Link>
      )}
    </div>
  );
}
function LearningArt() {
  return (
    <div className="learning-art" aria-hidden="true">
      <div className="art-window">
        <div className="art-sun" />
        <div className="art-hill one" />
        <div className="art-hill two" />
        <div className="art-school">
          <span />
          <i />
          <i />
          <i />
          <b />
        </div>
      </div>
      <div className="art-caption">
        <span className="art-icon">
          <Leaf size={24} />
        </span>
        <div>
          <strong>শেখার আনন্দে</strong>
          <small>A world of possibilities</small>
        </div>
        <Sparkles size={24} />
      </div>
      <div className="book-stack">
        <div />
        <div />
        <div />
      </div>
      <div className="art-label">LEARN. EXPLORE. GROW.</div>
    </div>
  );
}
const homeSections = [
  ["hero", "স্বাগত অংশ", "Welcome"],
  ["quick", "দ্রুত সেবার লিংক", "Quick links"],
  ["notices", "নোটিশ ও ভর্তি ঘোষণা", "Notices & admissions"],
  ["highlights", "শিক্ষা ও সুবিধা", "Highlights & facilities"],
  ["principal", "প্রধান শিক্ষকের বার্তা", "Principal message"],
  ["teachers", "শিক্ষক পরিচিতি", "Teachers"],
  ["gallery", "ছবির গ্যালারি", "Gallery preview"],
  ["news", "সংবাদ ও অনুষ্ঠান", "News & events"],
  ["contact", "যোগাযোগ", "Contact invitation"],
];
function HomepageLayout({ children }: { children: ReactNode }) {
  const { data } = useSchool();
  const configured = data.settings.home_sections;
  const order: string[] = Array.isArray(configured)
    ? configured
    : homeSections.map((r) => r[0]);
  return (
    <div className="homepage-layout">
      {Children.toArray(children).map((child, i) => {
        const key = homeSections[i]?.[0];
        return order.includes(key) ? (
          <div key={key} style={{ order: order.indexOf(key) }}>
            {child}
          </div>
        ) : null;
      })}
    </div>
  );
}
function ContentCards({ sections }: { sections: string[] }) {
  const { data, lang } = useSchool();
  const list = data.content.filter((r) => sections.includes(r.section));
  return list.length ? (
    <div className="cards">
      {list.map((r) => (
        <article className="card" key={r.id}>
          {safeUrl(r.image_url) && (
            <Photo url={r.image_url} alt={textOf(r, "title", lang)} />
          )}
          <h3>{textOf(r, "title", lang)}</h3>
          <p className="preline">{textOf(r, "body", lang)}</p>
        </article>
      ))}
    </div>
  ) : (
    <Empty />
  );
}
function Home() {
  const { data, lang, t, loading } = useSchool();
  const welcome = data.content.find((r) => r.section === "welcome"),
    principal = data.people.find((r) => r.kind === "principal");
  return (
    <HomepageLayout>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="little-line" />
              {t("প্রতিটি শিশুই সম্ভাবনাময়", "EVERY CHILD IS FULL OF POSSIBILITY")}
            </p>
            <h1>
              {textOf(data.settings, "tagline", lang) ||
                t("[স্বাগত শিরোনাম যোগ করুন]", "[Add your welcome headline]")}
            </h1>
            <p className="hero-description">
              {welcome
                ? textOf(welcome, "body", lang)
                : t(
                    "[অ্যাডমিন থেকে বিদ্যালয়ের পরিচিতি ও স্বাগত বার্তা যোগ করুন।]",
                    "[Add your school introduction and welcome message from the admin dashboard.]",
                  )}
            </p>
            <div className="hero-buttons">
              <Link className="button" to="/admission">
                <GraduationCap size={20} />
                {t("ভর্তি সম্পর্কে জানুন", "Explore admissions")}
              </Link>
              <Link className="button outline" to="/about">
                {t("আমাদের বিদ্যালয়", "Discover our school")}
              </Link>
            </div>
            <div className="hero-note">
              <ShieldCheck size={18} />
              {t(
                "প্রথম থেকে পঞ্চম শ্রেণি · বাংলা ও ইংরেজি তথ্যসেবা",
                "Classes 1–5 · Information in Bangla & English",
              )}
            </div>
          </div>
          <div className="hero-visual">
            {safeUrl(data.settings.hero_image_url) ? (
              <Photo
                url={data.settings.hero_image_url}
                alt={t("বিদ্যালয়ের পরিবেশ", "Our school environment")}
              />
            ) : (
              <LearningArt />
            )}
            <div className="visual-tag">
              <BookOpen size={19} />
              {t("ছোট্ট পদক্ষেপে, বড় স্বপ্নে", "Little steps. Big dreams.")}
            </div>
          </div>
        </div>
      </section>
      <div className="container quick-links">
        {[
          {
            to: "/notices",
            icon: Bell,
            bn: "নোটিশ বোর্ড",
            en: "Notice board",
            subbn: "সর্বশেষ তথ্য ও ঘোষণা",
            suben: "Updates & announcements",
          },
          {
            to: "/academics",
            icon: BookOpen,
            bn: "শিক্ষা কার্যক্রম",
            en: "Academics",
            subbn: "শেখার প্রতিদিনের সঙ্গী",
            suben: "Everyday learning resources",
          },
          {
            to: "/results",
            icon: GraduationCap,
            bn: "পরীক্ষার ফলাফল",
            en: "Student results",
            subbn: "নিরাপদে ফলাফল দেখুন",
            suben: "Secure result access",
          },
          {
            to: "/downloads",
            icon: Download,
            bn: "প্রয়োজনীয় নথি",
            en: "Downloads",
            subbn: "ফরম, সিলেবাস ও রুটিন",
            suben: "Forms, syllabus & routines",
          },
        ].map((item) => (
          <Link to={item.to} key={item.to}>
            <span className="quick-icon">
              <item.icon size={24} />
            </span>
            <span>
              <strong>{t(item.bn, item.en)}</strong>
              <small>{t(item.subbn, item.suben)}</small>
            </span>
          </Link>
        ))}
      </div>
      <section className="section container">
        <div className="home-updates">
          <div>
            <SectionTitle
              bn="বিদ্যালয়ের খবরাখবর"
              en="From our school desk"
              sub={t("নোটিশ ও ঘোষণা", "NOTICES & ANNOUNCEMENTS")}
              to="/notices"
            />
            {loading ? (
              <Spinner />
            ) : data.notices.length ? (
              <div className="notice-list">
                {data.notices.slice(0, 3).map((n) => (
                  <NoticeRow key={n.id} notice={n} />
                ))}
              </div>
            ) : (
              <Empty />
            )}
          </div>
          <aside className="admission-card">
            <span className="round-icon">
              <GraduationCap size={28} />
            </span>
            <p className="eyebrow">{t("নতুন যাত্রার শুরু", "A NEW CHAPTER")}</p>
            <h2>{t("আপনার শিশুর আগামীর জন্য", "For your child’s tomorrow")}</h2>
            <p>
              {data.settings.admission_open
                ? t(
                    "অনলাইনে ভর্তি আবেদন গ্রহণ করা হচ্ছে।",
                    "Online admission applications are open.",
                  )
                : t(
                    "ভর্তি তথ্য ও আবেদনের নিয়ম জানুন।",
                    "Find admission information and application requirements.",
                  )}
            </p>
            <Link className="button cream" to="/admission">
              {t("ভর্তি নির্দেশিকা দেখুন", "View admission guide")}
            </Link>
          </aside>
        </div>
      </section>
      <section className="soft-section">
        <div className="container section">
          <SectionTitle
            bn="শেখা হোক আনন্দময়"
            en="Space to learn. Room to grow."
            sub={t("আমাদের শিক্ষা ও পরিবেশ", "LEARNING & OUR ENVIRONMENT")}
          />
          <ContentCards sections={["highlights", "facilities"]} />
        </div>
      </section>
      <section className="container section principal-section">
        <div className="principal-frame">
          <Photo
            url={principal?.photo_url}
            alt={t("[প্রধান শিক্ষকের ছবি]", "[Principal photograph]")}
          />
          <span>
            <BookOpen size={22} />
            {t("প্রধান শিক্ষকের কথা", "A message from our principal")}
          </span>
        </div>
        <div>
          <p className="eyebrow">
            {t("স্নেহ, যত্ন ও শিক্ষায়", "CARE. CURIOSITY. CHARACTER.")}
          </p>
          <h2>
            {t(
              "একসাথে গড়ি সুন্দর আগামী",
              "A thoughtful start to a lifelong journey",
            )}
          </h2>
          {principal ? (
            <>
              <p className="preline">{textOf(principal, "bio", lang)}</p>
              <strong>{textOf(principal, "name", lang)}</strong>
              <small className="muted block">
                {textOf(principal, "designation", lang)}
              </small>
            </>
          ) : (
            <p className="placeholder-copy">
              {t(
                "[প্রধান শিক্ষকের পরিচয় ও বার্তা অ্যাডমিন থেকে যোগ করুন।]",
                "[Add the principal’s profile and message from the admin dashboard.]",
              )}
            </p>
          )}
          <Link className="text-link" to="/administration">
            {t("প্রশাসন সম্পর্কে জানুন", "Meet our administration")}
          </Link>
        </div>
      </section>
      <section className="soft-section">
        <div className="container section">
          <SectionTitle
            bn="আমাদের শিক্ষকবৃন্দ"
            en="The people behind the learning"
            to="/teachers"
          />
          {data.people.some((r) => r.kind === "teacher") ? (
            <div className="cards">
              {data.people
                .filter((r) => r.kind === "teacher")
                .slice(0, 3)
                .map((r) => (
                  <PersonCard key={r.id} person={r} />
                ))}
            </div>
          ) : (
            <Empty />
          )}
        </div>
      </section>
      <section className="container section">
        <SectionTitle
          bn="বিদ্যালয়ের কিছু মুহূর্ত"
          en="Little moments, lasting memories"
          to="/gallery"
        />
        {data.gallery.length ? (
          <GalleryGrid items={data.gallery.slice(0, 3)} />
        ) : (
          <Empty
            bn="বিদ্যালয়ের প্রকাশিত ছবি এখানে দেখা যাবে।"
            en="Published school photographs will appear here."
          />
        )}
      </section>
      <section className="container section no-top">
        <SectionTitle
          bn="সংবাদ ও আসন্ন অনুষ্ঠান"
          en="News & upcoming events"
          to="/news"
        />
        {data.events.filter((r) => r.kind !== "calendar").length ? (
          <EventCards
            items={data.events.filter((r) => r.kind !== "calendar").slice(0, 3)}
          />
        ) : (
          <Empty />
        )}
      </section>
      <section className="contact-band">
        <div className="container">
          <div>
            <p className="eyebrow">{t("আসুন, কথা বলি", "LET’S CONNECT")}</p>
            <h2>
              {t(
                "আপনার প্রশ্নে আমরা পাশে আছি",
                "We’re here to help your family.",
              )}
            </h2>
          </div>
          <Link className="button cream" to="/contact">
            <Mail size={18} />
            {t("যোগাযোগ করুন", "Get in touch")}
          </Link>
        </div>
      </section>
    </HomepageLayout>
  );
}
function About() {
  const { t } = useSchool();
  return (
    <>
      <PageHead
        title={t("আমাদের সম্পর্কে", "About our school")}
        subtitle={t(
          "আমাদের পরিচয়, লক্ষ্য ও পথচলা",
          "Our story, purpose and approach to learning",
        )}
      />
      <section className="container section">
        <ContentCards
          sections={[
            "welcome",
            "history",
            "mission",
            "vision",
            "objectives",
            "facilities",
            "achievements",
            "infrastructure",
          ]}
        />
        <div className="inline-links">
          <Link to="/administration">{t("প্রশাসন", "Administration")}</Link>
          <Link to="/teachers">{t("শিক্ষকবৃন্দ", "Our teachers")}</Link>
        </div>
      </section>
    </>
  );
}
function PersonCard({ person: r }: { person: RecordRow }) {
  const { lang } = useSchool();
  return (
    <article className="card person">
      <Photo url={r.photo_url} alt={textOf(r, "name", lang)} />
      <div>
        <h3>{textOf(r, "name", lang)}</h3>
        <p className="designation">{textOf(r, "designation", lang)}</p>
        <p>{textOf(r, "qualification", lang)}</p>
        <p>{textOf(r, "subjects", lang)}</p>
        <p className="preline">{textOf(r, "bio", lang)}</p>
      </div>
    </article>
  );
}
function PeoplePage({ administration = false }: { administration?: boolean }) {
  const { data, t } = useSchool();
  const people = data.people.filter((r) =>
    administration ? r.kind !== "teacher" : r.kind === "teacher",
  );
  return (
    <>
      <PageHead
        title={
          administration
            ? t("বিদ্যালয় প্রশাসন", "School administration")
            : t("আমাদের শিক্ষকবৃন্দ", "Meet our teachers")
        }
      />
      <section className="container section">
        {people.length ? (
          <div className="cards">
            {people.map((r) => (
              <PersonCard key={r.id} person={r} />
            ))}
          </div>
        ) : (
          <Empty />
        )}
      </section>
    </>
  );
}
function Academics() {
  const { data, t } = useSchool();
  const [level, setLevel] = useState("");
  return (
    <>
      <PageHead
        title={t("শিক্ষা কার্যক্রম", "Academics")}
        subtitle={t(
          "প্রথম থেকে পঞ্চম শ্রেণির শিক্ষা সহায়িকা",
          "Academic resources for Classes 1 through 5",
        )}
      />
      <section className="container section">
        <div className="toolbar">
          <label>
            {t("শ্রেণি নির্বাচন", "Choose class")}
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">{t("সকল শ্রেণি", "All classes")}</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option value={n} key={n}>
                  {t("শ্রেণি", "Class")} {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <DocumentList
          items={data.academic_documents.filter(
            (r) =>
              r.kind !== "download" &&
              r.kind !== "admission_form" &&
              (!level || !r.class_level || r.class_level === Number(level)),
          )}
        />
        <SectionTitle bn="সময়সূচি ও নীতিমালা" en="School timings & policies" />
        <ContentCards sections={["timings", "policies"]} />
        <SectionTitle bn="শিক্ষাপঞ্জি" en="Academic calendar" />
        <EventCards items={data.events.filter((r) => r.kind === "calendar")} />
      </section>
    </>
  );
}
function NoticeRow({ notice: n }: { notice: RecordRow }) {
  const { lang, t } = useSchool();
  const date = new Date(n.publish_at);
  return (
    <Link className="notice-row" to={`/notices/${n.id}`}>
      <div className="date-tile">
        <strong>
          {date.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", {
            day: "2-digit",
            timeZone: "Asia/Dhaka",
          })}
        </strong>
        <small>
          {date.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", {
            month: "short",
            timeZone: "Asia/Dhaka",
          })}
        </small>
      </div>
      <div>
        <span className="badge">
          {categoryLabel(n.category, lang)}
          {n.pinned ? ` · ${t("গুরুত্বপূর্ণ", "Pinned")}` : ""}
        </span>
        <h3>{textOf(n, "title", lang)}</h3>
        <small>{localeDate(n.publish_at, lang)}</small>
      </div>
      <FileText size={20} />
    </Link>
  );
}
const categories = [
  "general",
  "admission",
  "examination",
  "holiday",
  "important",
];
function categoryLabel(k: string, l: Lang) {
  return ({
    general: ["সাধারণ", "General"],
    admission: ["ভর্তি", "Admission"],
    examination: ["পরীক্ষা", "Examination"],
    holiday: ["ছুটি", "Holiday"],
    important: ["গুরুত্বপূর্ণ", "Important"],
  }[k] || [k, k])[l === "bn" ? 0 : 1];
}
function Notices() {
  const { data, t, lang, loading } = useSchool();
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("");
  const list = data.notices.filter(
    (r) =>
      (!category || r.category === category) &&
      `${textOf(r, "title", lang)} ${textOf(r, "body", lang)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title={t("নোটিশ বোর্ড", "Notice board")}
        subtitle={t(
          "বিদ্যালয়ের সর্বশেষ ঘোষণা ও গুরুত্বপূর্ণ তথ্য",
          "The latest announcements and important information",
        )}
      />
      <section className="container section">
        <div className="toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label={t("নোটিশ খুঁজুন", "Search notices")}
              placeholder={t("নোটিশ খুঁজুন…", "Search notices…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label={t("বিভাগ", "Category")}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">{t("সকল বিভাগ", "All categories")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c, lang)}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <Spinner />
        ) : list.length ? (
          <div className="notice-list">
            {list.map((n) => (
              <NoticeRow key={n.id} notice={n} />
            ))}
          </div>
        ) : (
          <Empty />
        )}
      </section>
    </>
  );
}
function NoticeDetail() {
  const { id } = useParams(),
    { data, t, lang, loading } = useSchool();
  const notice = data.notices.find((n) => n.id === id);
  if (loading) return <Spinner />;
  if (!notice) return <NotFound />;
  return (
    <>
      <PageHead
        title={textOf(notice, "title", lang)}
        subtitle={localeDate(notice.publish_at, lang)}
      />
      <article className="container section reading">
        <span className="badge">{categoryLabel(notice.category, lang)}</span>
        <p className="preline">{textOf(notice, "body", lang)}</p>
        {safeUrl(notice.attachment_url) && (
          <a
            className="button"
            target="_blank"
            rel="noopener noreferrer"
            href={notice.attachment_url}
          >
            <Download size={18} />
            {t("সংযুক্ত নথি খুলুন", "Open attachment")}
          </a>
        )}
      </article>
    </>
  );
}
function GalleryGrid({ items }: { items: RecordRow[] }) {
  const { lang } = useSchool();
  return (
    <div className="cards gallery-grid">
      {items.map((r) => (
        <figure className="gallery-item" key={r.id}>
          {r.media_type === "video" ? (
            <video
              controls
              preload="metadata"
              src={safeUrl(r.media_url)}
              aria-label={textOf(r, "title", lang)}
            />
          ) : (
            <a
              href={safeUrl(r.media_url)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Photo
                url={r.media_url}
                alt={textOf(r, "alt", lang) || textOf(r, "title", lang)}
              />
            </a>
          )}
          <figcaption>{textOf(r, "title", lang)}</figcaption>
        </figure>
      ))}
    </div>
  );
}
function Gallery() {
  const { data, t } = useSchool();
  const [category, setCategory] = useState("");
  const options = [
    ["classroom", "শ্রেণিকক্ষ", "Classroom"],
    ["cultural", "সংস্কৃতি", "Cultural"],
    ["sports", "খেলাধুলা", "Sports"],
    ["annual", "বার্ষিক অনুষ্ঠান", "Annual functions"],
    ["trips", "শিক্ষাসফর", "Trips"],
    ["events", "অনুষ্ঠান", "Events"],
  ];
  const list = data.gallery.filter((r) => !category || r.category === category);
  return (
    <>
      <PageHead title={t("স্মৃতির অ্যালবাম", "Our school in moments")} />
      <section className="container section">
        <div className="filter-pills">
          <button
            className={!category ? "active" : ""}
            onClick={() => setCategory("")}
          >
            {t("সব", "All")}
          </button>
          {options.map(([key, bn, en]) => (
            <button
              className={category === key ? "active" : ""}
              key={key}
              onClick={() => setCategory(key)}
            >
              {t(bn, en)}
            </button>
          ))}
        </div>
        {list.length ? <GalleryGrid items={list} /> : <Empty />}
      </section>
    </>
  );
}
function EventCards({ items }: { items: RecordRow[] }) {
  const { lang } = useSchool();
  return items.length ? (
    <div className="cards">
      {items.map((r) => (
        <article key={r.id} className="card event-card">
          {safeUrl(r.image_url) && (
            <Photo url={r.image_url} alt={textOf(r, "title", lang)} />
          )}
          <span className="event-date">
            <CalendarDays size={16} />
            {localeDate(r.event_date, lang)}
          </span>
          <h3>{textOf(r, "title", lang)}</h3>
          <p className="preline">{textOf(r, "body", lang)}</p>
        </article>
      ))}
    </div>
  ) : (
    <Empty />
  );
}
function News() {
  const { data, t } = useSchool();
  return (
    <>
      <PageHead title={t("সংবাদ ও অনুষ্ঠান", "News & events")} />
      <section className="container section">
        <EventCards items={data.events.filter((r) => r.kind !== "calendar")} />
      </section>
    </>
  );
}
function DocumentList({ items }: { items: RecordRow[] }) {
  const { lang, t } = useSchool();
  return items.length ? (
    <div className="document-list">
      {items.map((r) => (
        <article className="card document" key={r.id}>
          <FileText size={27} />
          <div>
            <h3>{textOf(r, "title", lang)}</h3>
            <p>{textOf(r, "body", lang)}</p>
            <small>
              {r.class_level ? `${t("শ্রেণি", "Class")} ${r.class_level}` : ""}
            </small>
          </div>
          {safeUrl(r.file_url) && (
            <a
              className="button outline small"
              href={r.file_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download size={17} />
              {t("খুলুন", "Open")}
            </a>
          )}
        </article>
      ))}
    </div>
  ) : (
    <Empty />
  );
}
function Downloads() {
  const { data, t } = useSchool();
  return (
    <>
      <PageHead
        title={t("ডাউনলোড কেন্দ্র", "Downloads")}
        subtitle={t(
          "প্রয়োজনীয় ফরম ও একাডেমিক নথি",
          "Official forms and academic documents",
        )}
      />
      <section className="container section">
        <DocumentList items={data.academic_documents} />
      </section>
    </>
  );
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}
function Captcha({
  onToken,
  resetKey,
}: {
  onToken: (v: string) => void;
  resetKey: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const key = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  useEffect(() => {
    if (!key || !ref.current) return;
    let id: string | undefined,
      cancel = false;
    const render = () => {
      if (cancel || !ref.current || !window.turnstile) return;
      id = window.turnstile.render(ref.current, {
        sitekey: key,
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    };
    let script = document.querySelector<HTMLScriptElement>("#turnstile-script");
    if (!script) {
      script = document.createElement("script");
      script.id = "turnstile-script";
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      document.head.appendChild(script);
    }
    if (window.turnstile) render();
    else script.addEventListener("load", render);
    return () => {
      cancel = true;
      script?.removeEventListener("load", render);
      if (id) window.turnstile?.remove(id);
    };
  }, [key, onToken, resetKey]);
  const { t } = useSchool();
  return key ? (
    <div ref={ref} className="captcha" />
  ) : (
    <p className="form-hint">
      {t(
        "নিরাপত্তা যাচাই এখনো কনফিগার করা হয়নি। ফরম পাঠানো বন্ধ আছে।",
        "Security verification is not configured. Form submission is unavailable.",
      )}
    </p>
  );
}
function Field({
  label,
  name,
  type = "text",
  required = true,
  ...props
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  [k: string]: any;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      {type === "textarea" ? (
        <textarea name={name} required={required} rows={4} {...props} />
      ) : (
        <input type={type} name={name} required={required} {...props} />
      )}
    </label>
  );
}
function AbuseProtection({
  onToken,
  resetKey,
}: {
  onToken: (v: string) => void;
  resetKey: number;
}) {
  const [startedAt, setStartedAt] = useState(() => Date.now());
  useEffect(() => setStartedAt(Date.now()), [resetKey]);
  return (
    <>
      <div className="honeypot" aria-hidden="true">
        <label>
          Company website
          <input
            name="company_website"
            tabIndex={-1}
            autoComplete="off"
            maxLength={2000}
          />
        </label>
      </div>
      <input type="hidden" name="form_started_at" value={startedAt} />
      {publicCaptchaRequired && (
        <Captcha onToken={onToken} resetKey={resetKey} />
      )}
    </>
  );
}
function Admission() {
  const { data, t, lang } = useSchool();
  const [tab, setTab] = useState("apply"),
    [token, setToken] = useState(""),
    [reset, setReset] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [answer, setAnswer] = useState<any>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setAnswer(null);
    setBusy(true);
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const payload =
        tab === "apply"
          ? admissionSchema.parse({
              ...values,
              consent: values.consent === "on",
            })
          : { code: String(values.code).trim() };
      const response = await publicCall(
        tab === "apply" ? "admission" : "track",
        payload,
        token,
        abuseFields(values),
      );
      setAnswer(response);
    } catch (e) {
      setError(
        e instanceof Error && e.name === "ZodError"
          ? t("সব তথ্য সঠিকভাবে পূরণ করুন।", "Please check all form fields.")
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
      setToken("");
      setReset((x) => x + 1);
    }
  }
  return (
    <>
      <PageHead
        title={t("ভর্তি তথ্য ও আবেদন", "Admissions")}
        subtitle={t(
          "আপনার শিশুর শিক্ষাযাত্রায় স্বাগতম",
          "A thoughtful beginning for your child",
        )}
      />
      <section className="container section form-layout">
        <aside>
          <p className="eyebrow">{t("ভর্তি নির্দেশিকা", "ADMISSION GUIDE")}</p>
          <h2>{t("আবেদনের আগে জেনে নিন", "Before you apply")}</h2>
          <p className="preline">
            {textOf(data.settings, "admission_requirements", lang) ||
              t(
                "[বিদ্যালয়ের ভর্তি নির্দেশিকা এখনো যোগ করা হয়নি।]",
                "[Admission requirements have not been added yet.]",
              )}
          </p>
          <p>
            <ShieldCheck size={18} />{" "}
            {t("কোনো অ্যাকাউন্ট খুলতে হবে না।", "No parent account is required.")}
          </p>
          <p>
            {t(
              "আবেদনের পর গোপন ট্র্যাকিং নম্বর সংরক্ষণ করুন।",
              "Keep your private tracking number after submitting.",
            )}
          </p>
          <Link className="text-link" to="/contact">
            {t("সহায়তার জন্য যোগাযোগ", "Contact for assistance")}
          </Link>
        </aside>
        <div className="form-card">
          <div className="filter-pills">
            <button
              className={tab === "apply" ? "active" : ""}
              onClick={() => {
                setTab("apply");
                setAnswer(null);
                setError("");
              }}
            >
              {t("নতুন আবেদন", "New application")}
            </button>
            <button
              className={tab === "track" ? "active" : ""}
              onClick={() => {
                setTab("track");
                setAnswer(null);
                setError("");
              }}
            >
              {t("আবেদনের অবস্থা", "Track application")}
            </button>
          </div>
          {error && <Message error>{error}</Message>}
          {answer &&
            (answer.tracking_code ? (
              <Message>
                <span>
                  {t(
                    "আবেদন জমা হয়েছে। এই নম্বর গোপনে সংরক্ষণ করুন:",
                    "Application submitted. Keep this number private:",
                  )}
                  <code className="access-code">{answer.tracking_code}</code>
                </span>
              </Message>
            ) : (
              <Message>
                {answer.status
                  ? `${t("অবস্থা", "Status")}: ${statusLabel(answer.status, lang)}`
                  : t(
                      "কোনো আবেদন পাওয়া যায়নি।",
                      "No matching application found.",
                    )}
              </Message>
            ))}
          {tab === "apply" && !data.settings.admission_open ? (
            <Empty
              bn="এই মুহূর্তে অনলাইন ভর্তি আবেদন বন্ধ আছে।"
              en="Online admissions are currently closed."
            />
          ) : (
            <form onSubmit={submit} key={tab}>
              <h3>
                {tab === "apply"
                  ? t("শিক্ষার্থীর তথ্য", "Student information")
                  : t("আপনার ট্র্যাকিং নম্বর দিন", "Enter your tracking number")}
              </h3>
              {tab === "apply" ? (
                <>
                  <div className="form-grid">
                    <Field
                      label={t("শিক্ষার্থীর নাম", "Student full name")}
                      name="student_name"
                      maxLength={120}
                      minLength={2}
                    />
                    <Field
                      label={t("জন্ম তারিখ", "Date of birth")}
                      name="birth_date"
                      type="date"
                      max={new Date().toISOString().slice(0, 10)}
                    />
                    <label className="field">
                      {t("শ্রেণি", "Class")} *
                      <select name="class_level" required>
                        <option value="">
                          {t("নির্বাচন করুন", "Select class")}
                        </option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option value={n} key={n}>
                            {t("শ্রেণি", "Class")} {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field
                      label={t("অভিভাবকের নাম", "Guardian name")}
                      name="guardian_name"
                      maxLength={120}
                      minLength={2}
                    />
                    <Field
                      label={t("মোবাইল নম্বর", "Mobile number")}
                      name="phone"
                      type="tel"
                      placeholder="01XXXXXXXXX"
                      pattern="(\+?88)?01[3-9][0-9]{8}"
                    />
                    <Field
                      label={t("ইমেইল (ঐচ্ছিক)", "Email (optional)")}
                      name="email"
                      type="email"
                      required={false}
                    />
                  </div>
                  <Field
                    label={t("ঠিকানা", "Address")}
                    name="address"
                    type="textarea"
                    minLength={5}
                    maxLength={1000}
                  />
                  <label className="checkbox">
                    <input name="consent" type="checkbox" required />
                    {t(
                      "আমি অভিভাবক হিসেবে ভর্তি প্রক্রিয়ায় এই তথ্য ব্যবহারের সম্মতি দিচ্ছি।",
                      "As the guardian, I consent to the school using this information for admission processing.",
                    )}
                  </label>
                </>
              ) : (
                <Field
                  label={t("ট্র্যাকিং নম্বর", "Tracking number")}
                  name="code"
                  autoComplete="off"
                  pattern="[a-f0-9]{32}"
                  maxLength={32}
                />
              )}
              <AbuseProtection onToken={setToken} resetKey={reset} />
              <button
                className="button"
                disabled={busy || (publicCaptchaRequired && !token) || !db}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <CheckCircle2 size={18} />
                )}{" "}
                {tab === "apply"
                  ? t("আবেদন জমা দিন", "Submit application")
                  : t("অবস্থা দেখুন", "Check status")}
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
function Results() {
  const { t, lang } = useSchool();
  const [token, setToken] = useState(""),
    [reset, setReset] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<any>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      setResult(await publicCall("result", values, token, abuseFields(values)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setToken("");
      setReset((x) => x + 1);
    }
  }
  return (
    <>
      <PageHead
        title={t("শিক্ষার্থীর ফলাফল", "Student results")}
        subtitle={t(
          "শুধু প্রকাশিত ফলাফল নিরাপদে দেখুন",
          "Secure access to published results",
        )}
      />
      <section className="container section narrow">
        <div className="form-card">
          <span className="round-icon">
            <ShieldCheck />
          </span>
          <h2>{t("ফলাফল অনুসন্ধান", "Find a result")}</h2>
          <p>
            {t(
              "বিদ্যালয় থেকে দেওয়া শিক্ষার্থী আইডি ও গোপন ফলাফল কোড দিন। প্রতিটি পরীক্ষার জন্য আলাদা কোড প্রয়োজন।",
              "Enter the student ID and private result code supplied by the school. Each examination has a separate code.",
            )}
          </p>
          <form onSubmit={submit}>
            <Field
              label={t("শিক্ষার্থী আইডি", "Student ID")}
              name="student_code"
              maxLength={50}
            />
            <Field
              label={t("গোপন ফলাফল কোড", "Private result code")}
              name="access_code"
              type="password"
              autoComplete="off"
              minLength={32}
              maxLength={32}
            />
            <AbuseProtection onToken={setToken} resetKey={reset} />
            <button
              className="button"
              disabled={!db || (publicCaptchaRequired && !token) || busy}
            >
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <Search size={18} />
              )}{" "}
              {t("ফলাফল দেখুন", "View result")}
            </button>
          </form>
          {error && <Message error>{error}</Message>}
        </div>
        {result &&
          (result.marks ? (
            <article className="form-card result-sheet">
              <h2>
                {lang === "en" ? result.exam_en || result.exam : result.exam}
              </h2>
              <p>
                {result.academic_year} · {t("শ্রেণি", "Class")} {result.class}
              </p>
              <table>
                <thead>
                  <tr>
                    <th>{t("বিষয়", "Subject")}</th>
                    <th>{t("প্রাপ্ত নম্বর", "Score")}</th>
                    <th>{t("পূর্ণ নম্বর", "Maximum")}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.marks.map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{r.subject}</td>
                      <td>{r.score}</td>
                      <td>{r.maximum}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>{t("মোট", "Total")}</th>
                    <th>
                      {result.marks.reduce(
                        (a: number, r: any) => a + Number(r.score),
                        0,
                      )}
                    </th>
                    <th>
                      {result.marks.reduce(
                        (a: number, r: any) => a + Number(r.maximum),
                        0,
                      )}
                    </th>
                  </tr>
                </tfoot>
              </table>
              <p>
                {t("গ্রেড", "Grade")}: {result.grade || "—"}
              </p>
              <p>
                {t("প্রকাশের তারিখ", "Published")}:{" "}
                {localeDate(result.published_at, lang)}
              </p>
              <button
                className="button outline no-print"
                onClick={() => window.print()}
              >
                <Printer size={18} />
                {t("প্রিন্ট করুন", "Print")}
              </button>
            </article>
          ) : (
            <Message>
              {t(
                "প্রকাশিত ফলাফল পাওয়া যায়নি। আইডি ও কোড পরীক্ষা করুন।",
                "No published result found. Check the student ID and private code.",
              )}
            </Message>
          ))}
      </section>
    </>
  );
}
function Contact() {
  const { data, t, lang } = useSchool();
  const [token, setToken] = useState(""),
    [reset, setReset] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError("");
    setSent(false);
    try {
      await publicCall(
        "contact",
        contactSchema.parse(values),
        token,
        abuseFields(values),
      );
      setSent(true);
      form.reset();
    } catch (e) {
      setError(
        (e as Error).name === "ZodError"
          ? t("তথ্য সঠিকভাবে পূরণ করুন।", "Please check your form fields.")
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
      setToken("");
      setReset((x) => x + 1);
    }
  }
  const map = safeUrl(data.settings.map_url);
  const embed =
    map &&
    new URL(map).hostname === "www.google.com" &&
    new URL(map).pathname.startsWith("/maps/embed")
      ? map
      : null;
  return (
    <>
      <PageHead
        title={t("যোগাযোগ করুন", "Get in touch")}
        subtitle={t(
          "আপনার প্রশ্ন ও পরামর্শ আমাদের জানান",
          "We welcome your questions and suggestions",
        )}
      />
      <section className="container section form-layout">
        <aside>
          <h2>{textOf(data.settings, "school_name", lang)}</h2>
          <ContactDetails />
          {safeUrl(data.settings.facebook_url) && (
            <a
              className="text-link"
              href={data.settings.facebook_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Facebook
            </a>
          )}
          {embed ? (
            <iframe
              className="map"
              title={t("বিদ্যালয়ের অবস্থান", "School location")}
              src={embed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : map ? (
            <a
              className="button outline"
              href={map}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin size={18} />
              {t("ম্যাপে দেখুন", "Open map")}
            </a>
          ) : (
            <p className="form-hint">
              {t(
                "[বিদ্যালয়ের মানচিত্র এখনো যোগ করা হয়নি।]",
                "[School map has not been added yet.]",
              )}
            </p>
          )}
        </aside>
        <div className="form-card">
          <h2>{t("বার্তা পাঠান", "Send us a message")}</h2>
          <p>
            {t(
              "বার্তা বিদ্যালয়ের অ্যাডমিনের কাছে সংরক্ষিত হবে।",
              "Your message will be stored for the school administrator.",
            )}
          </p>
          {sent && (
            <Message>
              {t(
                "আপনার বার্তা পাঠানো হয়েছে।",
                "Your message has been submitted.",
              )}
            </Message>
          )}
          {error && <Message error>{error}</Message>}
          <form onSubmit={submit}>
            <Field
              label={t("আপনার নাম", "Your name")}
              name="name"
              maxLength={120}
              minLength={2}
            />
            <div className="form-grid">
              <Field label={t("ইমেইল", "Email")} name="email" type="email" />
              <Field
                label={t("ফোন (ঐচ্ছিক)", "Phone (optional)")}
                name="phone"
                type="tel"
                maxLength={20}
                required={false}
              />
            </div>
            <Field
              label={t("বার্তা", "Message")}
              name="message"
              type="textarea"
              minLength={10}
              maxLength={4000}
            />
            <AbuseProtection onToken={setToken} resetKey={reset} />
            <button
              className="button"
              disabled={busy || (publicCaptchaRequired && !token) || !db}
            >
              <Mail size={18} />
              {busy
                ? t("পাঠানো হচ্ছে…", "Sending…")
                : t("বার্তা পাঠান", "Send message")}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
function ContactDetails() {
  const { data, t, lang } = useSchool();
  const s = data.settings;
  return (
    <div className="contact-details">
      <p>
        <MapPin size={18} />
        {textOf(s, "address", lang) ||
          t("[ঠিকানা যোগ করুন]", "[Add school address]")}
      </p>
      <p>
        <Phone size={18} />
        {s.phone ? (
          <a href={`tel:${String(s.phone).replace(/[^+\d]/g, "")}`}>
            {s.phone}
          </a>
        ) : (
          t("[ফোন নম্বর যোগ করুন]", "[Add phone number]")
        )}
      </p>
      <p>
        <Mail size={18} />
        {s.email ? (
          <a href={`mailto:${s.email}`}>{s.email}</a>
        ) : (
          t("[ইমেইল যোগ করুন]", "[Add email address]")
        )}
      </p>
    </div>
  );
}
function Footer() {
  const { data, lang, t } = useSchool();
  return (
    <footer>
      <div className="container footer-grid">
        <div>
          <Link to="/" className="brand">
            <IconBook />
            <span>
              <strong>{textOf(data.settings, "school_name", lang)}</strong>
              <small>
                {t(
                  "শেখার আনন্দে, আগামীর পথে",
                  "A thoughtful start for tomorrow",
                )}
              </small>
            </span>
          </Link>
          <p>{textOf(data.settings, "tagline", lang)}</p>
        </div>
        <div>
          <h3>{t("বিদ্যালয়", "Our school")}</h3>
          {(["about", "administration", "teachers", "news"] as const).map(
            (k) => (
              <Link key={k} to={`/${k}`}>
                {labels[k][lang === "bn" ? 0 : 1]}
              </Link>
            ),
          )}
        </div>
        <div>
          <h3>{t("প্রয়োজনীয় সেবা", "Quick access")}</h3>
          {(["admission", "notices", "results", "downloads"] as const).map(
            (k) => (
              <Link key={k} to={`/${k}`}>
                {labels[k][lang === "bn" ? 0 : 1]}
              </Link>
            ),
          )}
        </div>
        <div>
          <h3>{t("আমাদের ঠিকানা", "Visit & contact")}</h3>
          <ContactDetails />
        </div>
      </div>
      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()}{" "}
          {textOf(data.settings, "school_name", lang)}
        </span>
        <span>
          {t(
            "শিশুর তথ্যের গোপনীয়তা আমাদের অঙ্গীকার",
            "Committed to student privacy",
          )}
        </span>
        <Link to="/admin/login">{t("অ্যাডমিন লগইন", "Admin login")}</Link>
      </div>
    </footer>
  );
}
function NotFound() {
  const { t } = useSchool();
  return (
    <section className="container section narrow">
      <p className="eyebrow">404</p>
      <h1>{t("পৃষ্ঠা খুঁজে পাওয়া যায়নি", "Page not found")}</h1>
      <p>
        {t(
          "ঠিকানা পরীক্ষা করুন অথবা প্রচ্ছদে ফিরে যান।",
          "Check the address or return to the homepage.",
        )}
      </p>
      <Link className="button" to="/">
        {t("প্রচ্ছদে ফিরুন", "Back to home")}
      </Link>
    </section>
  );
}

function statusLabel(status: string, lang: Lang) {
  const map: Record<string, string[]> = {
    pending: ["অপেক্ষমাণ", "Pending"],
    reviewing: ["পর্যালোচনাধীন", "Under review"],
    approved: ["অনুমোদিত", "Approved"],
    rejected: ["অননুমোদিত", "Rejected"],
    unread: ["অপঠিত", "Unread"],
    read: ["পঠিত", "Read"],
    resolved: ["সমাধান হয়েছে", "Resolved"],
    present: ["উপস্থিত", "Present"],
    absent: ["অনুপস্থিত", "Absent"],
    late: ["বিলম্বিত", "Late"],
    excused: ["অনুমোদিত ছুটি", "Excused"],
  };
  return map[status]?.[lang === "bn" ? 0 : 1] || status;
}

function AdminShell({ setLang }: { setLang: (v: Lang) => void }) {
  const { t } = useSchool();
  const [session, setSession] = useState<Session | null>(null),
    [checking, setChecking] = useState(!!db),
    [authorized, setAuthorized] = useState(false),
    [authError, setAuthError] = useState("");
  const navigate = useNavigate(),
    location = useLocation();
  const verifiedUser = useRef<string | null>(null),
    verificationSequence = useRef(0);
  useEffect(() => {
    if (!db) return;
    let live = true;
    const verify = async (s: Session | null) => {
      if (!live) return;
      const sequence = ++verificationSequence.current;
      const userChanged = verifiedUser.current !== (s?.user.id || null);
      if (userChanged || !s) {
        setChecking(true);
        setAuthorized(false);
      }
      setSession(s);
      if (s) {
        const result = await Promise.resolve(db!.rpc("is_admin")).catch(() => ({
          data: false,
          error: true,
        }));
        if (live && sequence === verificationSequence.current) {
          verifiedUser.current = s.user.id;
          setAuthorized(result.data === true);
          setAuthError(
            result.error
              ? "Unable to verify access. Please sign in again."
              : result.data
                ? ""
                : "This account is not the school administrator.",
          );
        }
      } else {
        verifiedUser.current = null;
        setAuthError("");
      }
      if (live && sequence === verificationSequence.current) setChecking(false);
    };
    void db.auth
      .getSession()
      .then(({ data }) => verify(data.session))
      .catch(() => {
        if (live) {
          setChecking(false);
          setAuthError("Unable to restore your session. Please sign in again.");
        }
      });
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_event, s) => {
      setTimeout(() => void verify(s), 0);
    });
    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    document.title = t("অ্যাডমিন · বিদ্যালয়", "Admin · School portal");
    document.querySelector('meta[name="robots"]')?.remove();
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [t]);
  const login = location.pathname === "/admin/login",
    reset = location.pathname === "/admin/reset-password";
  if (checking) return <Spinner />;
  if (reset) return <AuthCard mode="reset" session={session} />;
  if (!session || !authorized)
    return (
      <>
        <div className="admin-login-top">
          <Link to="/" className="brand">
            <IconBook />
            {t("বিদ্যালয়ে ফিরুন", "Back to school")}
          </Link>
          <Language setLang={setLang} />
        </div>
        {authError && (
          <div className="container">
            <Message error>
              {authError}{" "}
              <button
                className="text-button"
                onClick={() => void db?.auth.signOut()}
              >
                Sign out
              </button>
            </Message>
          </div>
        )}
        <AuthCard mode="login" session={session} />
      </>
    );
  if (login) return <AdminRedirect />;
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <Link className="brand" to="/admin">
          <IconBook />
          <span>
            <strong>{t("বিদ্যালয় ব্যবস্থাপনা", "School workspace")}</strong>
            <small>SUPER ADMIN</small>
          </span>
        </Link>
        <nav>
          <NavLink end to="/admin">
            <LayoutDashboard size={18} />
            {t("সারসংক্ষেপ", "Overview")}
          </NavLink>
          {Object.entries(modules).map(([k, m]) => (
            <NavLink to={`/admin/${k}`} key={k}>
              {k === "settings" || k === "seo" ? (
                <Settings size={17} />
              ) : k === "students" || k === "teachers" ? (
                <Users size={17} />
              ) : (
                <FileText size={17} />
              )}{" "}
              {t(m.bn, m.en)}
            </NavLink>
          ))}
          <NavLink to="/admin/media">
            <ImageIcon size={17} />
            {t("ফাইল লাইব্রেরি", "File library")}
          </NavLink>
          <NavLink to="/admin/profile">
            <ShieldCheck size={17} />
            {t("প্রোফাইল ও পাসওয়ার্ড", "Profile & password")}
          </NavLink>
        </nav>
      </aside>
      <div className="admin-main">
        <div className="admin-topbar">
          <span>
            <span className="badge">
              {t("সুরক্ষিত কর্মক্ষেত্র", "Secure workspace")}
            </span>
          </span>
          <div>
            <Link to="/">{t("ওয়েবসাইট দেখুন", "View website")}</Link>
            <Language setLang={setLang} />
            <button
              className="text-button"
              onClick={async () => {
                const { error } = await db!.auth.signOut();
                if (error) setAuthError("Sign out failed. Please try again.");
                else navigate("/admin/login");
              }}
            >
              <LogOut size={17} />
              {t("লগআউট", "Sign out")}
            </button>
          </div>
        </div>
        <main className="admin-content">
          {authError && <Message error>{authError}</Message>}
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/profile" element={<Profile session={session} />} />
            <Route path="/media" element={<MediaLibrary />} />
            <Route path="/:module" element={<Manager />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
function AdminRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/admin", { replace: true });
  }, [navigate]);
  return <Spinner />;
}
function AuthCard({
  mode,
  session,
}: {
  mode: "login" | "reset";
  session: Session | null;
}) {
  const { t } = useSchool();
  const [error, setError] = useState(""),
    [info, setInfo] = useState(""),
    [busy, setBusy] = useState(false),
    [forgot, setForgot] = useState(false);
  const navigate = useNavigate();
  const [captchaToken, setCaptchaToken] = useState(""),
    [captchaReset, setCaptchaReset] = useState(0);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (!db)
        throw new Error(
          t("আগে Supabase সংযুক্ত করুন।", "Connect Supabase before signing in."),
        );
      if (authCaptchaEnabled && mode === "login" && !captchaToken)
        throw new Error(
          t("নিরাপত্তা যাচাই সম্পন্ন করুন।", "Complete the security verification."),
        );
      if (mode === "reset") {
        if (!session)
          throw new Error(
            t(
              "ইমেইলের রিকভারি লিংক খুলুন।",
              "Open the recovery link from your email.",
            ),
          );
        if (values.password !== values.confirm)
          throw new Error(
            t("পাসওয়ার্ড দুটি মিলছে না।", "Passwords do not match."),
          );
        const result = await db.auth.updateUser({
          password: String(values.password),
        });
        if (result.error) throw result.error;
        setInfo(
          t("পাসওয়ার্ড পরিবর্তন হয়েছে।", "Your password has been updated."),
        );
      } else if (forgot) {
        const result = await db.auth.resetPasswordForEmail(
          String(values.email),
          {
            redirectTo: `${location.origin}/admin/reset-password`,
            captchaToken: authCaptchaEnabled ? captchaToken : undefined,
          },
        );
        if (result.error) throw result.error;
        setInfo(
          t(
            "অ্যাকাউন্টটি থাকলে রিকভারি ইমেইল পাঠানো হবে।",
            "If the account exists, a recovery email will be sent.",
          ),
        );
      } else {
        const result = await db.auth.signInWithPassword({
          email: String(values.email),
          password: String(values.password),
          options: {
            captchaToken: authCaptchaEnabled ? captchaToken : undefined,
          },
        });
        if (result.error) throw result.error;
        navigate("/admin");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setCaptchaToken("");
      setCaptchaReset((v) => v + 1);
    }
  }
  return (
    <section className="auth-wrap">
      <div className="form-card">
        <span className="round-icon">
          <LockKeyhole />
        </span>
        <p className="eyebrow">
          {t("শুধু অনুমোদিত অ্যাডমিনের জন্য", "AUTHORIZED ADMINISTRATOR ONLY")}
        </p>
        <h1>
          {mode === "reset"
            ? t("নতুন পাসওয়ার্ড", "Set a new password")
            : forgot
              ? t("অ্যাক্সেস পুনরুদ্ধার", "Recover access")
              : t("স্বাগতম, অ্যাডমিন", "Welcome back")}
        </h1>
        <p>
          {t(
            "বিদ্যালয়ের তথ্য ও শিক্ষাসেবা পরিচালনা করুন।",
            "Manage your school’s information and academic services.",
          )}
        </p>
        {!db && (
          <Message error>
            {t(
              "সেটআপ প্রয়োজন। .env ফাইলে Supabase প্রকল্প সংযুক্ত করুন।",
              "Setup required. Connect your Supabase project in the .env file.",
            )}
          </Message>
        )}
        {mode === "reset" && !session && db && (
          <Message error>
            {t(
              "এই ব্রাউজারে একটি বৈধ আমন্ত্রণ বা রিকভারি লিংক খুলুন। লিংকের মেয়াদ শেষ হলে নতুন লিংক নিন।",
              "Open a valid invitation or recovery link in this browser. Request a new link if it expired.",
            )}
          </Message>
        )}
        {error && <Message error>{error}</Message>}
        {info && <Message>{info}</Message>}
        <form onSubmit={submit}>
          {mode === "login" && (
            <Field
              label={t("ইমেইল", "Email address")}
              name="email"
              type="email"
              autoComplete="username"
            />
          )}
          {(!forgot || mode === "reset") && (
            <Field
              label={t("পাসওয়ার্ড", "Password")}
              name="password"
              type="password"
              minLength={mode === "reset" ? 12 : 1}
              autoComplete={
                mode === "reset" ? "new-password" : "current-password"
              }
            />
          )}
          {mode === "reset" && (
            <Field
              label={t("পাসওয়ার্ড আবার দিন", "Confirm password")}
              name="confirm"
              type="password"
              minLength={12}
              autoComplete="new-password"
            />
          )}
          {mode === "login" && authCaptchaEnabled && (
            <Captcha onToken={setCaptchaToken} resetKey={captchaReset} />
          )}
          <button
            className="button full"
            disabled={
              !db ||
              busy ||
              (mode === "login" && authCaptchaEnabled && !captchaToken) ||
              (mode === "reset" && !session)
            }
          >
            {busy ? <LoaderCircle className="spin" size={18} /> : null}
            {mode === "reset"
              ? t("পাসওয়ার্ড সংরক্ষণ", "Save password")
              : forgot
                ? t("রিকভারি লিংক পাঠান", "Send recovery link")
                : t("নিরাপদে লগইন", "Sign in securely")}
          </button>
        </form>
        {mode === "login" && (
          <button
            className="text-button"
            onClick={() => {
              setForgot(!forgot);
              setError("");
              setInfo("");
            }}
          >
            {forgot
              ? t("লগইনে ফিরুন", "Back to sign in")
              : t("পাসওয়ার্ড ভুলে গেছেন?", "Forgot your password?")}
          </button>
        )}
        {mode === "reset" && (
          <Link to="/admin">{t("ড্যাশবোর্ডে যান", "Open dashboard")}</Link>
        )}
      </div>
    </section>
  );
}
function Dashboard() {
  const { t } = useSchool();
  const [stats, setStats] = useState<Record<string, number>>({}),
    [error, setError] = useState("");
  useEffect(() => {
    void Promise.all(
      ["students", "admissions", "notices", "contact_messages"].map(
        async (table) => {
          const { count, error } = await db!
            .from(table)
            .select("id", { count: "exact", head: true });
          if (error) throw error;
          return [table, count || 0];
        },
      ),
    )
      .then((r) => setStats(Object.fromEntries(r)))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <p className="eyebrow">
        {t("আপনার বিদ্যালয়, আপনার নিয়ন্ত্রণে", "YOUR SCHOOL. YOUR WORKSPACE.")}
      </p>
      <h1>{t("আজকের সারসংক্ষেপ", "School overview")}</h1>
      <p className="muted">
        {t(
          "তথ্য হালনাগাদ করুন, আবেদন দেখুন এবং শিক্ষা কার্যক্রম পরিচালনা করুন।",
          "Keep information current, review applications and manage academics.",
        )}
      </p>
      {error && <Message error>{error}</Message>}
      <div className="stats-grid">
        {[
          ["students", "শিক্ষার্থী", "Students"],
          ["admissions", "ভর্তি আবেদন", "Applications"],
          ["notices", "নোটিশ", "Notices"],
          ["contact_messages", "বার্তা", "Messages"],
        ].map(([key, bn, en]) => (
          <article className="card" key={key}>
            <span>{t(bn, en)}</span>
            <strong>{stats[key] ?? "—"}</strong>
          </article>
        ))}
      </div>
      <div className="cards">
        {[
          ["notices", "নোটিশ প্রকাশ করুন", "Publish a notice"],
          ["admissions", "ভর্তি আবেদন পর্যালোচনা", "Review admissions"],
          ["results", "পরীক্ষার ফলাফল পরিচালনা", "Manage results"],
          ["school", "বিদ্যালয়ের তথ্য পরিবর্তন", "Update school information"],
          ["gallery", "ছবি ও ভিডিও পরিচালনা", "Manage gallery"],
          ["students", "শিক্ষার্থী পরিচালনা", "Manage students"],
        ].map(([key, bn, en]) => (
          <Link className="card dashboard-link" to={`/admin/${key}`} key={key}>
            <Pencil size={22} />
            <h3>{t(bn, en)}</h3>
          </Link>
        ))}
      </div>
    </>
  );
}

const fieldNames: Record<string, string> = {
  school_name: "বিদ্যালয়ের নাম",
  tagline: "স্বাগত শিরোনাম",
  address: "ঠিকানা",
  phone: "ফোন",
  email: "ইমেইল",
  logo_url: "লোগো",
  hero_image_url: "প্রচ্ছদের ছবি",
  map_url: "Google Maps লিংক",
  facebook_url: "Facebook লিংক",
  admission_open: "অনলাইন ভর্তি চালু",
  admission_requirements: "ভর্তির নির্দেশিকা",
  seo_description: "মেটা বিবরণ",
  social_image_url: "সোশ্যাল শেয়ারের ছবি",
  section: "বিষয়",
  title: "শিরোনাম",
  body: "বিস্তারিত",
  image_url: "ছবি",
  sort_order: "ক্রম",
  kind: "ধরন",
  name: "নাম",
  designation: "পদবি",
  bio: "পরিচিতি",
  qualification: "শিক্ষাগত যোগ্যতা",
  subjects: "পাঠদানের বিষয়",
  photo_url: "প্রোফাইল ছবি",
  level: "শ্রেণি",
  class_level: "শ্রেণি",
  class_id: "শ্রেণি ও শাখা",
  section_name: "শাখা",
  academic_year: "শিক্ষাবর্ষ",
  student_code: "শিক্ষার্থী আইডি",
  roll: "রোল",
  guardian_name: "অভিভাবকের নাম",
  birth_date: "জন্ম তারিখ",
  active: "সক্রিয়",
  student_name: "শিক্ষার্থীর নাম",
  status: "অবস্থা",
  admin_notes: "অ্যাডমিনের নোট",
  category: "বিভাগ",
  attachment_url: "সংযুক্ত PDF",
  pinned: "শীর্ষে রাখুন",
  publish_at: "প্রকাশের সময়",
  published: "প্রকাশিত",
  exam_date: "পরীক্ষার তারিখ",
  student_id: "শিক্ষার্থী",
  exam_id: "পরীক্ষা",
  marks: "বিষয়ভিত্তিক নম্বর",
  grade: "গ্রেড / GPA",
  attendance_date: "উপস্থিতির তারিখ",
  file_url: "ফাইল",
  event_date: "অনুষ্ঠানের তারিখ",
  media_type: "মিডিয়ার ধরন",
  media_url: "মিডিয়া",
  alt: "ছবির বর্ণনা",
  message: "বার্তা",
};
const choices: Record<string, string[]> = {
  section: [
    "welcome",
    "history",
    "mission",
    "vision",
    "objectives",
    "facilities",
    "achievements",
    "infrastructure",
    "highlights",
    "timings",
    "policies",
  ],
  kind: ["principal", "assistant_head", "teacher", "staff", "committee"],
  category: categories,
  media_type: ["image", "video"],
};
const bools = ["published", "pinned", "active", "admission_open", "consent"];
const relationTables: Record<string, string> = {
  class_id: "classes",
  student_id: "students",
  exam_id: "exams",
};
const defaults: Record<string, Record<string, unknown>> = {
  homepage: { section: "welcome" },
  about: { section: "history" },
  principal: { kind: "principal" },
  teachers: { kind: "teacher" },
  staff: { kind: "staff" },
  committee: { kind: "committee" },
  routines: { kind: "routine" },
  downloads: { kind: "download" },
  calendar: { kind: "calendar" },
  news: { kind: "news" },
  notices: { category: "general", publish_at: new Date().toISOString() },
  gallery: { category: "classroom", media_type: "image" },
  students: { active: true },
  admissions: { status: "pending" },
  messages: { status: "unread" },
  attendance: { status: "present" },
  results: {
    marks: [{ subject: "", score: 0, maximum: 100 }],
    published: false,
    publish_at: new Date().toISOString(),
  },
  classes: { academic_year: new Date().getFullYear(), section: "A" },
  exams: { academic_year: new Date().getFullYear() },
};
function fieldLabel(field: string, lang: Lang) {
  const base = field.replace(/_(bn|en)$/, "");
  const suffix = field.endsWith("_bn")
    ? " · বাংলা"
    : field.endsWith("_en")
      ? " · English"
      : "";
  return (
    (lang === "bn"
      ? fieldNames[base] || base
      : base.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase())) +
    suffix
  );
}
function moduleFilter(key: string, r: RecordRow) {
  if (key === "principal")
    return ["principal", "assistant_head"].includes(r.kind);
  if (["principal", "teachers", "staff", "committee"].includes(key))
    return r.kind === ({ teachers: "teacher" }[key] || key);
  if (key === "calendar") return r.kind === "calendar";
  if (key === "news") return r.kind !== "calendar";
  if (key === "downloads")
    return ["download", "admission_form"].includes(r.kind);
  if (key === "routines")
    return !["download", "admission_form"].includes(r.kind);
  if (key === "about") return !["welcome", "highlights"].includes(r.section);
  return true;
}
function Manager() {
  const { module: key = "" } = useParams(),
    config = modules[key];
  const { t, lang, reload: reloadPublic } = useSchool();
  const [records, setRecords] = useState<RecordRow[]>([]),
    [relations, setRelations] = useState<Record<string, RecordRow[]>>({}),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [info, setInfo] = useState(""),
    [search, setSearch] = useState(""),
    [edit, setEdit] = useState<RecordRow | null>(null),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(false),
    [remove, setRemove] = useState<RecordRow | null>(null);
  const load = useCallback(async () => {
    if (!config) return;
    setLoading(true);
    setError("");
    try {
      setRecords(
        (await rows(config.table)).filter((r) => moduleFilter(key, r)),
      );
      const needed = [
        ...new Set(
          config.fields
            .filter((f) => relationTables[f])
            .map((f) => relationTables[f]),
        ),
      ];
      const rs = await Promise.all(
        needed.map(async (table) => [table, await rows(table)]),
      );
      setRelations(Object.fromEntries(rs));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [config, key]);
  useEffect(() => {
    setEdit(null);
    setRemove(null);
    setSearch("");
    setInfo("");
    void load();
  }, [load]);
  if (!config) return <NotFound />;
  const singleton = config.table === "settings",
    list = records.filter((r) =>
      JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
    );
  function newRecord() {
    setEdit({ id: "", ...defaults[key] });
    setPreview(false);
    setError("");
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    setError("");
    try {
      const payload = Object.fromEntries(
        config.fields
          .filter((f) => edit[f] !== undefined)
          .map((f) => [
            f,
            edit[f] === "" &&
            ["class_level", ...Object.keys(relationTables)].includes(f)
              ? null
              : edit[f],
          ]),
      );
      if (config.publish) payload.published = !!edit.published;
      if (config.table === "results") payload.marks = edit.marks;
      const q = edit.id
        ? db!.from(config.table).update(payload).eq("id", edit.id)
        : db!.from(config.table).insert(payload);
      const result = await q.select();
      if (result.error) throw result.error;
      if (!result.data?.length)
        throw new Error(
          "No record was saved. Check administrator authorization.",
        );
      setEdit(null);
      setInfo(t("পরিবর্তন সংরক্ষিত হয়েছে।", "Changes saved."));
      await load();
      await reloadPublic();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function deleteRecord() {
    if (!remove) return;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await db!
        .from(config.table)
        .delete()
        .eq("id", remove.id)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("No record was deleted.");
      setRemove(null);
      setInfo(t("রেকর্ড মুছে ফেলা হয়েছে।", "Record deleted."));
      await load();
      await reloadPublic();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("ব্যবস্থাপনা", "MANAGEMENT")}</p>
          <h1>{t(config.bn, config.en)}</h1>
        </div>
        {!config.readonly && !singleton && (
          <button className="button" onClick={newRecord}>
            <Plus size={18} />
            {t("নতুন যোগ করুন", "Add new")}
          </button>
        )}
      </div>
      {info && <Message>{info}</Message>}
      {error && <Message error>{error}</Message>}
      {!edit && (
        <>
          <div className="toolbar">
            <label className="search-field">
              <Search size={18} />
              <input
                aria-label={t("খুঁজুন", "Search records")}
                placeholder={t("রেকর্ড খুঁজুন…", "Search records…")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <button
              className="button outline small"
              onClick={() => void load()}
            >
              {t("রিফ্রেশ", "Refresh")}
            </button>
          </div>
          {loading ? (
            <Spinner />
          ) : list.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("নাম / তথ্য", "Record")}</th>
                    <th>{t("ধরন / অবস্থা", "Type / status")}</th>
                    <th>{t("তৈরির তারিখ", "Created")}</th>
                    <th>{t("করণীয়", "Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>
                          {textOf(r, "title", lang) ||
                            textOf(r, "school_name", lang) ||
                            textOf(r, "name", lang) ||
                            r.student_name ||
                            r.student_code ||
                            r.table_name ||
                            relations.students?.find(
                              (s) => s.id === r.student_id,
                            )?.name_bn ||
                            r.id}
                        </strong>
                        <small className="block muted">
                          {r.email ||
                            r.phone ||
                            r.action ||
                            r.tracking_code ||
                            r.id}
                        </small>
                        {key === "results" && (
                          <details>
                            <summary>
                              {t("গোপন ফলাফল কোড", "Private result code")}
                            </summary>
                            <code>{r.access_code}</code>
                            <p>
                              {t(
                                "শুধু সংশ্লিষ্ট অভিভাবককে নিরাপদে দিন।",
                                "Share securely with this student’s guardian only.",
                              )}
                            </p>
                          </details>
                        )}
                      </td>
                      <td>
                        <span className="badge">
                          {"published" in r
                            ? r.published
                              ? t("প্রকাশিত", "Published")
                              : t("খসড়া", "Draft")
                            : statusLabel(
                                r.status ||
                                  r.kind ||
                                  r.category ||
                                  r.section ||
                                  r.role ||
                                  "—",
                                lang,
                              )}
                        </span>
                        {r.publish_at &&
                          new Date(r.publish_at) > new Date() && (
                            <small className="block">
                              {t("নির্ধারিত প্রকাশ", "Scheduled")}
                            </small>
                          )}
                      </td>
                      <td>{localeDate(r.created_at, lang)}</td>
                      <td>
                        {!config.readonly && (
                          <div className="row-actions">
                            <button
                              className="icon-button"
                              aria-label={t("সম্পাদনা", "Edit")}
                              onClick={() => {
                                setEdit({ ...r });
                                setPreview(false);
                                setError("");
                              }}
                            >
                              <Pencil size={17} />
                            </button>
                            {!singleton && (
                              <button
                                className="icon-button danger"
                                aria-label={t("মুছুন", "Delete")}
                                onClick={() => setRemove(r)}
                              >
                                <Trash2 size={17} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              bn="কোনো রেকর্ড নেই। নতুন তথ্য যোগ করুন।"
              en="No records yet. Add your first record."
            />
          )}
        </>
      )}
      {edit && (
        <div className="form-card">
          <div className="section-heading">
            <h2>
              {edit.id
                ? t("তথ্য সম্পাদনা", "Edit record")
                : t("নতুন রেকর্ড", "New record")}
            </h2>
            <button
              className="icon-button"
              aria-label="Close editor"
              onClick={() => setEdit(null)}
            >
              <X />
            </button>
          </div>
          {preview ? (
            <div className="record-preview">
              <p className="eyebrow">
                {t("সংরক্ষণের আগের প্রিভিউ", "PREVIEW BEFORE SAVING")}
              </p>
              {config.fields.map((f) => (
                <div key={f}>
                  <strong>{fieldLabel(f, lang)}</strong>
                  {f.endsWith("_url") && safeUrl(edit[f]) ? (
                    <a href={edit[f]} target="_blank" rel="noopener noreferrer">
                      {edit[f]}
                    </a>
                  ) : (
                    <p className="preline">
                      {typeof edit[f] === "object"
                        ? JSON.stringify(edit[f], null, 2)
                        : String(edit[f] ?? "—")}
                    </p>
                  )}
                </div>
              ))}
              <button
                className="button outline"
                onClick={() => setPreview(false)}
              >
                {t("সম্পাদনায় ফিরুন", "Back to editing")}
              </button>
            </div>
          ) : (
            <form onSubmit={save}>
              <div className="form-grid">
                {config.fields.map((field) => (
                  <AdminField
                    key={field}
                    field={field}
                    value={edit[field]}
                    onChange={(value) => setEdit({ ...edit, [field]: value })}
                    moduleKey={key}
                    relations={relations}
                  />
                ))}
              </div>
              {config.publish && (
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={!!edit.published}
                    onChange={(e) =>
                      setEdit({ ...edit, published: e.target.checked })
                    }
                  />
                  {t(
                    "প্রকাশ করুন (অন্যথায় খসড়া হিসেবে থাকবে)",
                    "Publish (otherwise save as draft)",
                  )}
                </label>
              )}
              {config.table === "results" && (
                <p className="form-hint">
                  {t(
                    "ফলাফলের গোপন কোড সংরক্ষণের পরে তালিকায় দেখা যাবে। গ্রেড বিদ্যালয়ের নীতিমালা অনুযায়ী লিখুন।",
                    "The private result code appears in the list after saving. Enter grades according to the school’s grading policy.",
                  )}
                </p>
              )}
              <div className="form-actions">
                <button className="button" disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}{" "}
                  {t("সংরক্ষণ করুন", "Save changes")}
                </button>
                <button
                  className="button outline"
                  type="button"
                  onClick={() => setPreview(true)}
                >
                  <Eye size={18} />
                  {t("প্রিভিউ", "Preview")}
                </button>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setEdit(null)}
                >
                  {t("বাতিল", "Cancel")}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
      {remove && (
        <div className="modal-backdrop">
          <section
            className="form-card modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">
              {t("রেকর্ড মুছে ফেলবেন?", "Delete this record?")}
            </h2>
            <p>
              {t(
                "এই রেকর্ড স্থায়ীভাবে মুছে যাবে। সংযুক্ত অন্য রেকর্ড থাকলে আগে সেগুলো পরিবর্তন করতে হবে। আপলোড করা ফাইল আলাদাভাবে লাইব্রেরি থেকে মুছতে হবে।",
                "This permanently deletes the record. Related records may prevent deletion. Uploaded files remain in the file library until separately deleted.",
              )}
            </p>
            <div className="form-actions">
              <button
                className="button danger-fill"
                disabled={busy}
                onClick={() => void deleteRecord()}
              >
                {t("স্থায়ীভাবে মুছুন", "Delete permanently")}
              </button>
              <button
                className="button outline"
                onClick={() => setRemove(null)}
              >
                {t("বাতিল", "Cancel")}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
function AdminField({
  field,
  value,
  onChange,
  moduleKey,
  relations,
}: {
  field: string;
  value: any;
  onChange: (v: any) => void;
  moduleKey: string;
  relations: Record<string, RecordRow[]>;
}) {
  const { lang, t } = useSchool();
  const label = fieldLabel(field, lang);
  let options: string[] | undefined = choices[field];
  if (field === "home_sections") {
    const ordered: string[] = Array.isArray(value)
      ? value
      : homeSections.map((s) => s[0]);
    const all = [
      ...ordered,
      ...homeSections.map((s) => s[0]).filter((s) => !ordered.includes(s)),
    ];
    return (
      <fieldset className="full-span">
        <legend>
          {t("বিভাগ চালু/বন্ধ ও ক্রম পরিবর্তন", "Show, hide and reorder sections")}
        </legend>
        {all.map((key, i) => {
          const section = homeSections.find((s) => s[0] === key);
          if (!section) return null;
          return (
            <div className="layout-row" key={key}>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={ordered.includes(key)}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...ordered, key]
                        : ordered.filter((s) => s !== key),
                    )
                  }
                />
                {t(section[1], section[2])}
              </label>
              {ordered.includes(key) && (
                <div className="row-actions">
                  <button
                    className="button outline small"
                    type="button"
                    disabled={i === 0}
                    onClick={() => {
                      const updated = [...ordered];
                      [updated[i - 1], updated[i]] = [
                        updated[i],
                        updated[i - 1],
                      ];
                      onChange(updated);
                    }}
                  >
                    {t("আগে", "Move up")}
                  </button>
                  <button
                    className="button outline small"
                    type="button"
                    disabled={i === ordered.length - 1}
                    onClick={() => {
                      const updated = [...ordered];
                      [updated[i + 1], updated[i]] = [
                        updated[i],
                        updated[i + 1],
                      ];
                      onChange(updated);
                    }}
                  >
                    {t("পরে", "Move down")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </fieldset>
    );
  }
  if (field === "section" && moduleKey === "classes") options = undefined;
  if (field === "kind" && ["routines", "downloads"].includes(moduleKey))
    options = [
      "routine",
      "exam_routine",
      "syllabus",
      "curriculum",
      "download",
      "admission_form",
    ];
  if (field === "kind" && ["calendar", "news"].includes(moduleKey))
    options = ["news", "event", "calendar"];
  if (field === "category" && moduleKey === "gallery")
    options = ["classroom", "cultural", "sports", "annual", "trips", "events"];
  if (field === "status")
    options =
      moduleKey === "admissions"
        ? ["pending", "reviewing", "approved", "rejected"]
        : moduleKey === "messages"
          ? ["unread", "read", "resolved"]
          : ["present", "absent", "late", "excused"];
  if (field === "marks") {
    const marks = Array.isArray(value) ? value : [];
    return (
      <div className="field full-span">
        <span>{label} *</span>
        <div className="marks-editor">
          {marks.map((m: any, i: number) => (
            <div className="marks-row" key={i}>
              <input
                aria-label={`Subject ${i + 1}`}
                placeholder={t("বিষয়", "Subject")}
                value={m.subject}
                required
                maxLength={100}
                onChange={(e) =>
                  onChange(
                    marks.map((r, j) =>
                      j === i ? { ...r, subject: e.target.value } : r,
                    ),
                  )
                }
              />
              <input
                aria-label={`Score ${i + 1}`}
                type="number"
                min={0}
                max={m.maximum}
                step="0.01"
                value={m.score}
                required
                onChange={(e) =>
                  onChange(
                    marks.map((r, j) =>
                      j === i ? { ...r, score: Number(e.target.value) } : r,
                    ),
                  )
                }
              />
              <input
                aria-label={`Maximum ${i + 1}`}
                type="number"
                min={0.01}
                step="0.01"
                value={m.maximum}
                required
                onChange={(e) =>
                  onChange(
                    marks.map((r, j) =>
                      j === i ? { ...r, maximum: Number(e.target.value) } : r,
                    ),
                  )
                }
              />
              <button
                type="button"
                className="icon-button danger"
                aria-label="Remove subject"
                onClick={() => onChange(marks.filter((_, j) => j !== i))}
              >
                <X size={17} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-button"
            onClick={() =>
              onChange([...marks, { subject: "", score: 0, maximum: 100 }])
            }
          >
            <Plus size={16} />
            {t("বিষয় যোগ করুন", "Add subject")}
          </button>
        </div>
      </div>
    );
  }
  if (bools.includes(field))
    return (
      <label className="checkbox">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>
    );
  if (relationTables[field]) {
    const records = relations[relationTables[field]] || [];
    return (
      <label className="field">
        <span>{label} *</span>
        <select
          required
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{t("নির্বাচন করুন", "Select record")}</option>
          {records.map((r) => (
            <option key={r.id} value={r.id}>
              {textOf(r, "name", lang) || r.student_code}{" "}
              {r.section ? `· ${r.section} · ${r.academic_year}` : ""}
              {r.roll ? ` · ${r.student_code} · ${r.roll}` : ""}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (options)
    return (
      <label className="field">
        <span>{label} *</span>
        <select
          required
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{t("নির্বাচন করুন", "Select")}</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o === "general" || categories.includes(o)
                ? categoryLabel(o, lang)
                : statusLabel(o, lang).replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
    );
  if (field.endsWith("_url"))
    return (
      <div className="field">
        <span>{label}</span>
        <input
          type="url"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
        />
        {!["map_url", "facebook_url"].includes(field) && (
          <UploadControl
            bucket={
              field === "logo_url" ||
              field === "hero_image_url" ||
              field === "social_image_url"
                ? "branding"
                : field === "photo_url"
                  ? "teachers"
                  : field === "media_url"
                    ? "gallery"
                    : field === "attachment_url" || field === "file_url"
                      ? "academic-documents"
                      : "website-media"
            }
            onUploaded={onChange}
          />
        )}
      </div>
    );
  const multiline =
    /^(body|bio|address|admission_requirements|seo_description|admin_notes|message)/.test(
      field,
    );
  const numeric = [
      "level",
      "class_level",
      "academic_year",
      "sort_order",
    ].includes(field),
    date = field.endsWith("_date"),
    datetime = field === "publish_at";
  let display = value ?? "";
  if (datetime && display) {
    const d = new Date(display);
    display = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }
  const required = [
    "title_bn",
    "name_bn",
    "school_name_bn",
    "student_name",
    "guardian_name",
    "phone",
    "birth_date",
    "academic_year",
    "level",
    "roll",
    "student_code",
    "event_date",
    "exam_date",
    "attendance_date",
    "publish_at",
  ].includes(field);
  return (
    <label className={`field ${multiline ? "full-span" : ""}`}>
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      {multiline ? (
        <textarea
          rows={4}
          value={display}
          required={required}
          maxLength={20000}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          value={display}
          required={required}
          type={
            numeric
              ? "number"
              : datetime
                ? "datetime-local"
                : date
                  ? "date"
                  : field === "email"
                    ? "email"
                    : "text"
          }
          min={
            ["level", "class_level"].includes(field)
              ? 1
              : field === "academic_year"
                ? 2000
                : undefined
          }
          max={
            ["level", "class_level"].includes(field)
              ? 5
              : field === "academic_year"
                ? 2100
                : undefined
          }
          maxLength={numeric || date || datetime ? undefined : 500}
          onChange={(e) =>
            onChange(
              numeric
                ? e.target.value === ""
                  ? null
                  : Number(e.target.value)
                : datetime
                  ? e.target.value
                    ? new Date(e.target.value).toISOString()
                    : ""
                  : e.target.value,
            )
          }
        />
      )}
    </label>
  );
}
function UploadControl({
  bucket,
  onUploaded,
}: {
  bucket: string;
  onUploaded: (url: string) => void;
}) {
  const { t } = useSchool();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="upload-control">
      <label className={`button outline small ${busy ? "disabled" : ""}`}>
        <Upload size={15} />
        {busy ? t("আপলোড হচ্ছে…", "Uploading…") : t("ফাইল আপলোড", "Upload file")}
        <input
          type="file"
          className="sr-only"
          disabled={busy}
          accept={
            bucket === "academic-documents"
              ? ".pdf"
              : bucket === "gallery"
                ? ".jpg,.jpeg,.png,.webp,.mp4,.webm"
                : bucket === "admission-documents"
                  ? ".jpg,.jpeg,.png,.pdf"
                  : ".jpg,.jpeg,.png,.webp"
          }
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setError("");
            try {
              const form = new FormData();
              form.append("file", file);
              form.append("bucket", bucket);
              const { data, error } = await db!.functions.invoke("upload", {
                body: form,
              });
              if (error || data.error)
                throw new Error(data?.error || error?.message);
              onUploaded(data.url || data.path);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      </label>
      {error && (
        <span role="alert" className="field-error">
          {error}
        </span>
      )}
    </div>
  );
}
function Profile({ session }: { session: Session }) {
  const { t } = useSchool();
  const [captchaToken, setCaptchaToken] = useState(""),
    [captchaReset, setCaptchaReset] = useState(0);
  const [name, setName] = useState(""),
    [info, setInfo] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void db!
      .from("admins")
      .select("display_name")
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setName(data.display_name);
      });
  }, []);
  return (
    <>
      <h1>{t("প্রোফাইল ও পাসওয়ার্ড", "Profile & password")}</h1>
      <div className="form-card narrow-left">
        <p>{session.user.email}</p>
        {info && <Message>{info}</Message>}
        {error && <Message error>{error}</Message>}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setInfo("");
            const result = await db!
              .from("admins")
              .update({ display_name: name })
              .eq("user_id", session.user.id)
              .select();
            if (result.error) setError(result.error.message);
            else if (!result.data?.length) setError("No profile was saved.");
            else setInfo(t("প্রোফাইল সংরক্ষিত।", "Profile saved."));
            setBusy(false);
          }}
        >
          <Field
            label={t("আপনার নাম", "Display name")}
            name="name"
            value={name}
            onChange={(e: any) => setName(e.target.value)}
            minLength={2}
            maxLength={120}
          />
          <button className="button" disabled={busy}>
            {t("প্রোফাইল সংরক্ষণ", "Save profile")}
          </button>
        </form>
        <hr />
        <h2>{t("পাসওয়ার্ড পরিবর্তন", "Change password")}</h2>
        <p>
          {t(
            "নিরাপত্তার জন্য বর্তমান পাসওয়ার্ড দিন।",
            "Confirm your current password before changing it.",
          )}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              v = Object.fromEntries(new FormData(form));
            setError("");
            setInfo("");
            setBusy(true);
            try {
              if (v.password !== v.confirm)
                throw new Error(
                  t(
                    "নতুন পাসওয়ার্ড দুটি মিলছে না।",
                    "New passwords do not match.",
                  ),
                );
              const verify = await db!.auth.signInWithPassword({
                email: session.user.email!,
                password: String(v.current),
                options: {
                  captchaToken: authCaptchaEnabled ? captchaToken : undefined,
                },
              });
              if (verify.error) throw verify.error;
              const result = await db!.auth.updateUser({
                password: String(v.password),
              });
              if (result.error) throw result.error;
              setInfo(t("পাসওয়ার্ড পরিবর্তন হয়েছে।", "Password updated."));
              form.reset();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
              setCaptchaToken("");
              setCaptchaReset((v) => v + 1);
            }
          }}
        >
          <Field
            label={t("বর্তমান পাসওয়ার্ড", "Current password")}
            name="current"
            type="password"
            autoComplete="current-password"
          />
          <Field
            label={t(
              "নতুন পাসওয়ার্ড (অন্তত ১২ অক্ষর)",
              "New password (at least 12 characters)",
            )}
            name="password"
            type="password"
            minLength={12}
            autoComplete="new-password"
          />
          <Field
            label={t("নতুন পাসওয়ার্ড আবার দিন", "Confirm new password")}
            name="confirm"
            type="password"
            minLength={12}
            autoComplete="new-password"
          />
          {authCaptchaEnabled && (
            <Captcha onToken={setCaptchaToken} resetKey={captchaReset} />
          )}
          <button
            className="button"
            disabled={busy || (authCaptchaEnabled && !captchaToken)}
          >
            {t("পাসওয়ার্ড পরিবর্তন", "Update password")}
          </button>
        </form>
      </div>
    </>
  );
}
function MediaLibrary() {
  const { t } = useSchool();
  const [bucket, setBucket] = useState("branding"),
    [files, setFiles] = useState<
      { name: string; path: string; url?: string }[]
    >([]),
    [error, setError] = useState(""),
    [info, setInfo] = useState(""),
    [deleting, setDeleting] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError("");
    const { data: folders, error } = await db!.storage
      .from(bucket)
      .list("", { limit: 100 });
    if (error) {
      setError(error.message);
      return;
    }
    const groups = await Promise.all(
      (folders || []).map(async (folder) => {
        const list = folder.id
          ? [folder]
          : (await db!.storage.from(bucket).list(folder.name, { limit: 1000 }))
              .data || [];
        return list
          .filter((f) => f.id)
          .map((f) => {
            const path = folder.id ? f.name : `${folder.name}/${f.name}`;
            return {
              name: f.name,
              path,
              url:
                bucket === "admission-documents"
                  ? undefined
                  : db!.storage.from(bucket).getPublicUrl(path).data.publicUrl,
            };
          });
      }),
    );
    setFiles(groups.flat());
  }, [bucket]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <>
      <h1>{t("ফাইল লাইব্রেরি", "File library")}</h1>
      <p>
        {t(
          "প্রকাশ্য বাকেটে রাখা ফাইল সরাসরি লিংকের মাধ্যমে দেখা যায়। শিক্ষার্থীর ব্যক্তিগত নথি শুধু admission-documents বাকেটে রাখুন।",
          "Files in public buckets can be accessed by direct link. Store private student documents only in admission-documents.",
        )}
      </p>
      <div className="toolbar">
        <select
          aria-label="Storage bucket"
          value={bucket}
          onChange={(e) => setBucket(e.target.value)}
        >
          {[
            "branding",
            "teachers",
            "gallery",
            "admission-documents",
            "academic-documents",
            "website-media",
          ].map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
        <UploadControl
          bucket={bucket}
          onUploaded={() => {
            setInfo(t("ফাইল আপলোড হয়েছে।", "File uploaded."));
            void load();
          }}
        />
      </div>
      {error && <Message error>{error}</Message>}
      {info && <Message>{info}</Message>}
      {files.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("ফাইল", "File")}</th>
                <th>{t("করণীয়", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.path}>
                  <td>
                    {f.name}
                    <small className="block muted">{f.path}</small>
                  </td>
                  <td>
                    <div className="row-actions">
                      {f.url ? (
                        <a
                          className="text-button"
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t("খুলুন", "Open")}
                        </a>
                      ) : (
                        <button
                          className="text-button"
                          onClick={async () => {
                            const { data, error } = await db!.storage
                              .from(bucket)
                              .createSignedUrl(f.path, 60);
                            if (error) setError(error.message);
                            else if (data)
                              window.open(
                                data.signedUrl,
                                "_blank",
                                "noopener,noreferrer",
                              );
                          }}
                        >
                          {t("নিরাপদে খুলুন", "Open privately")}
                        </button>
                      )}
                      <button
                        className="icon-button danger"
                        aria-label="Delete file"
                        onClick={() => setDeleting(f.path)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty />
      )}
      {deleting && (
        <div className="modal-backdrop">
          <div
            className="form-card modal"
            role="dialog"
            aria-modal="true"
            aria-label="Delete file"
          >
            <h2>{t("ফাইল স্থায়ীভাবে মুছবেন?", "Permanently delete file?")}</h2>
            <p>{deleting}</p>
            <p>
              {t(
                "এই ফাইল ব্যবহার করা পৃষ্ঠাগুলোর লিংক কাজ করবে না।",
                "Links on pages that use this file will stop working.",
              )}
            </p>
            <div className="form-actions">
              <button
                className="button danger-fill"
                onClick={async () => {
                  const { error } = await db!.storage
                    .from(bucket)
                    .remove([deleting]);
                  if (error) setError(error.message);
                  else {
                    setInfo(t("ফাইল মুছে ফেলা হয়েছে।", "File deleted."));
                    await load();
                  }
                  setDeleting(null);
                }}
              >
                {t("মুছুন", "Delete")}
              </button>
              <button
                className="button outline"
                onClick={() => setDeleting(null)}
              >
                {t("বাতিল", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

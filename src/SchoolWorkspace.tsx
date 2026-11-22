import { useEffect, useState, type FormEvent, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { db, publicCaptchaRequired, rows } from "./lib";
type Row = Record<string, any>;
type CaptchaProps = { onToken: (v: string) => void; resetKey: number };
const tables = [
  "teacher_accounts",
  "subjects",
  "class_subjects",
  "teacher_assignments",
  "classes",
  "exams",
  "exam_settings",
  "exam_subjects",
  "assessment_components",
  "grading_schemes",
  "mark_submissions",
  "subject_marks",
  "mark_history",
  "result_sheets",
  "students",
  "enrollments",
  "student_details",
  "academic_years",
  "admin_invitations",
  "secondary_admins",
  "teacher_attendance",
  "class_attendance",
  "timetable",
  "homework",
];
async function rpc(name: string, args: Row = {}) {
  if (!db) throw Error("Connect the school database first");
  const r = await db.rpc(name, args);
  if (r.error) throw Error(r.error.message);
  return r.data;
}
async function save(table: string, value: Row, conflict?: string) {
  if (!db) throw Error("Database unavailable");
  const r = conflict
    ? await db.from(table).upsert(value, { onConflict: conflict })
    : await db.from(table).insert(value);
  if (r.error) throw Error(r.error.message);
}
const label = (r: Row) =>
  r.name_bn ||
  r.name_en ||
  r.full_name ||
  r.title ||
  r.name ||
  r.year ||
  r.student_code ||
  r.id;
const values = (e: FormEvent<HTMLFormElement>) =>
  Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
function Select({
  name,
  title,
  items,
  required = true,
}: {
  name: string;
  title: string;
  items: Row[];
  required?: boolean;
}) {
  return (
    <label>
      {title}
      <select name={name} required={required}>
        <option value="">Select / নির্বাচন করুন</option>
        {items.map((r) => (
          <option key={r.id} value={r.id}>
            {label(r)}
          </option>
        ))}
      </select>
    </label>
  );
}
function Input({
  name,
  title,
  type = "text",
  required = true,
  ...rest
}: {
  name: string;
  title: string;
  type?: string;
  required?: boolean;
  [k: string]: any;
}) {
  return (
    <label>
      {title}
      <input name={name} type={type} required={required} {...rest} />
    </label>
  );
}
function Notice({ text }: { text: string }) {
  return text ? (
    <p role="status" className="message">
      {text}
    </p>
  ) : null;
}
function Form({
  children,
  submit,
  onSubmit,
}: {
  children: React.ReactNode;
  submit: string;
  onSubmit: (v: Record<string, string>) => Promise<void | string>;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      className="card school-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget,
          v = values(e);
        setBusy(true);
        setMessage("");
        try {
          const response = await onSubmit(v);
          setMessage(response || "Saved / সংরক্ষিত");
          form.reset();
        } catch (e) {
          setMessage((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      <button className="button" disabled={busy}>
        {busy ? "Please wait…" : submit}
      </button>
      <Notice text={message} />
    </form>
  );
}
export function TeacherRegistration({
  Captcha,
}: {
  Captcha: ComponentType<CaptchaProps>;
}) {
  const [started, setStarted] = useState(Date.now()),
    [token, setToken] = useState(""),
    [reset, setReset] = useState(0);
  return (
    <section className="container section school-workspace">
      <h1>শিক্ষক নিবন্ধন / Teacher registration</h1>
      <p>
        Only teachers may register. Email verification and school approval are
        required. Students and guardians do not need accounts.
      </p>
      <Form
        submit="Request teacher account / নিবন্ধনের আবেদন"
        onSubmit={async (v) => {
          try {
            const { email, company_website, form_started_at, ...profile } = v;
            const r = await db!.functions.invoke("school-accounts", {
              body: {
                action: "register_teacher",
                email,
                profile,
                company_website,
                form_started_at: Number(form_started_at),
                captcha: token,
              },
            });
            if (r.error) {
              const b = await r.error.context?.json?.().catch(() => null);
              throw Error(b?.error || "Registration unavailable");
            }
            if (r.data.error) throw Error(r.data.error);
            return String(r.data.message);
          } finally {
            setToken("");
            setReset((n) => n + 1);
            setStarted(Date.now());
          }
        }}
      >
        <Input name="full_name" title="পূর্ণ নাম / Full name" maxLength={120} />
        <Input name="email" title="Email" type="email" maxLength={254} />
        <Input
          name="phone"
          title="ফোন / Phone"
          type="tel"
          pattern="(\+?88)?01[3-9][0-9]{8}"
        />
        <Input name="designation" title="পদবি / Designation" maxLength={120} />
        <Input name="gender" title="Gender (optional)" required={false} />
        <Input
          name="qualification"
          title="Qualification (optional)"
          required={false}
        />
        <Input
          name="joining_date"
          title="Joining date (optional)"
          type="date"
          required={false}
        />
        <label>
          Requested classes and subjects / পছন্দের শ্রেণি ও বিষয়
          <textarea name="requested_assignments" maxLength={2000} />
        </label>
        <label>
          Short biography (optional)
          <textarea name="biography" maxLength={2000} />
        </label>
        <p>
          Upload your photograph securely after opening the email link.
          Class/subject requests do not grant permissions; an Admin assigns
          them.
        </p>
        <div className="honeypot" aria-hidden="true">
          <input name="company_website" tabIndex={-1} autoComplete="off" />
        </div>
        <input type="hidden" name="form_started_at" value={started} />
        {publicCaptchaRequired && (
          <Captcha onToken={setToken} resetKey={reset} />
        )}
      </Form>
      <Link to="/admin/login">Teacher/Admin login / লগইন</Link>
    </section>
  );
}
export function AccountStatus({
  role,
  onRefresh,
}: {
  role: string;
  onRefresh: () => void;
}) {
  const [message, setMessage] = useState(""),
    [profile, setProfile] = useState<Row | null>(null);
  useEffect(() => {
    void db
      ?.from("teacher_accounts")
      .select("*")
      .then((r) => setProfile(r.data?.[0] || null));
  }, []);
  return (
    <section className="container section">
      <h1>Account access / অ্যাকাউন্টের অবস্থা</h1>
      <p>
        Status: <strong>{role}</strong>. Pending, rejected and suspended
        teachers cannot open a school dashboard. Contact the school for review.
      </p>
      {role === "none" && (
        <button
          className="button"
          onClick={async () => {
            try {
              await rpc("accept_admin_invitation");
              onRefresh();
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          Accept my verified Admin invitation
        </button>
      )}
      {profile && (
        <TeacherProfile
          key={JSON.stringify(profile)}
          profile={profile}
          onRefresh={() => {
            void db
              ?.from("teacher_accounts")
              .select("*")
              .then((r) => setProfile(r.data?.[0] || null));
            onRefresh();
          }}
        />
      )}
      <Notice text={message} />
      <button className="text-button" onClick={onRefresh}>
        Refresh account status / অবস্থা দেখুন
      </button>
      <button className="text-button" onClick={() => void db?.auth.signOut()}>
        Sign out / লগআউট
      </button>
      <Link to="/">School website</Link>
    </section>
  );
}
function TeacherProfile({
  profile,
  onRefresh,
}: {
  profile: Row;
  onRefresh: () => void;
}) {
  const [message, setMessage] = useState("");
  return (
    <details className="card" open>
      <summary>My teacher profile / আমার প্রোফাইল</summary>
      <Form
        submit="Save profile"
        onSubmit={async (v) => {
          await rpc("update_teacher_profile", {
            p_profile: { ...v, photo_path: profile.photo_path },
          });
          onRefresh();
        }}
      >
        {[
          ["full_name", "Full name"],
          ["phone", "Phone"],
          ["designation", "Designation"],
          ["gender", "Gender"],
          ["qualification", "Qualification"],
          ["biography", "Biography"],
        ].map(([name, title]) => (
          <Input
            key={name}
            name={name}
            title={title}
            defaultValue={profile[name]}
            required={["full_name", "phone", "designation"].includes(name)}
          />
        ))}
        <Input
          name="joining_date"
          title="Joining date"
          type="date"
          defaultValue={profile.joining_date || ""}
          required={false}
        />
      </Form>
      <label>
        Private photograph
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const f = new FormData();
              f.set("bucket", "teacher-private");
              f.set("file", file);
              const r = await db!.functions.invoke("upload", { body: f });
              if (r.error || r.data.error) throw Error("Upload failed");
              await rpc("update_teacher_profile", {
                p_profile: { ...profile, photo_path: r.data.path },
              });
              setMessage("Photograph saved privately");
              onRefresh();
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        />
      </label>
      {profile.photo_path && (
        <button
          className="text-button"
          onClick={async () => {
            const r = await db!.storage
              .from("teacher-private")
              .createSignedUrl(profile.photo_path, 60);
            if (r.data) window.open(r.data.signedUrl, "_blank", "noopener");
          }}
        >
          View my photograph
        </button>
      )}
      <Notice text={message} />
    </details>
  );
}
export function TeacherWorkspace({
  administrative = false,
}: {
  administrative?: boolean;
}) {
  const [data, setData] = useState<Record<string, Row[]>>({}),
    [selected, setSelected] = useState(""),
    [roster, setRoster] = useState<Row[]>([]),
    [message, setMessage] = useState(""),
    [version, setVersion] = useState(0);
  const reload = () => setVersion((n) => n + 1);
  useEffect(() => {
    let live = true;
    void (async () => {
      const result: Record<string, Row[]> = {};
      for (const t of [
        "teacher_accounts",
        "classes",
        "subjects",
        "class_subjects",
        "exam_subjects",
        "assessment_components",
        "exams",
        "exam_settings",
        "mark_submissions",
        "subject_marks",
        "mark_history",
        "teacher_attendance",
        "timetable",
        "homework",
        "class_attendance",
      ]) {
        result[t] = await rows(t);
      }
      if (live) setData(result);
    })().catch((e) => setMessage(e.message));
    return () => {
      live = false;
    };
  }, [version]);
  const es = data.exam_subjects?.find((r) => r.id === selected),
    exam = data.exams?.find((r) => r.id === es?.exam_id),
    components =
      data.assessment_components?.filter(
        (r) => r.exam_subject_id === selected,
      ) || [],
    submission = data.mark_submissions?.find(
      (r) => r.exam_subject_id === selected,
    ),
    locked = submission && submission.status !== "draft",
    cfg = data.exam_settings?.find((r) => r.exam_id === exam?.id);
  useEffect(() => {
    setRoster([]);
    if (exam)
      void rpc("class_roster", { p_class: exam.class_id })
        .then(setRoster)
        .catch((e) => setMessage(e.message));
  }, [exam?.id, version]);
  return (
    <div className="container section school-workspace">
      <header>
        <h1>শিক্ষক কর্মক্ষেত্র / Teacher workspace</h1>
        <Link to="/">School website</Link>
        <button className="text-button" onClick={() => void db!.auth.signOut()}>
          Sign out
        </button>
      </header>
      <Notice text={message} />
      <p>
        Only approved, assigned classes/subjects appear. Submitted marks stay
        locked until an Admin reopens them.
      </p>
      {!administrative && data.teacher_accounts?.[0] && (
        <TeacherProfile profile={data.teacher_accounts[0]} onRefresh={reload} />
      )}
      <details>
        <summary>Assigned classes and subjects / নির্ধারিত শ্রেণি ও বিষয়</summary>
        <ul>
          {data.class_subjects?.map((cs) => (
            <li key={cs.id}>
              {data.classes?.find((c) => c.id === cs.class_id)?.name_bn} ·{" "}
              {data.classes?.find((c) => c.id === cs.class_id)?.section} ·{" "}
              {data.subjects?.find((s) => s.id === cs.subject_id)?.name_bn}
            </li>
          ))}
        </ul>
      </details>
      <label>
        Assigned examination / নির্ধারিত পরীক্ষা
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Select exam and subject</option>
          {data.exam_subjects?.map((r) => {
            const e = data.exams?.find((x) => x.id === r.exam_id),
              cs = data.class_subjects?.find(
                (x) => x.id === r.class_subject_id,
              ),
              sub = data.subjects?.find((x) => x.id === cs?.subject_id),
              cl = data.classes?.find((x) => x.id === cs?.class_id);
            return (
              <option key={r.id} value={r.id}>
                {e?.name_bn} · {cl?.name_bn} {cl?.section} · {sub?.name_bn}
              </option>
            );
          })}
        </select>
      </label>
      {es && (
        <>
          <p>
            Status: {submission?.status || "not started"} · Revision{" "}
            {submission?.revision || 1} · Entry{" "}
            {cfg?.entry_open ? "open" : "closed"} · Deadline{" "}
            {cfg?.deadline ? new Date(cfg.deadline).toLocaleString() : ""}
          </p>
          <form
            className="card school-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const v = new FormData(form);
              const submit =
                (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
                  "value",
                ) === "submit";
              const marks = roster
                .filter((r) => ["active", "promoted"].includes(r.status))
                .filter(
                  (r) =>
                    submit ||
                    components.every(
                      (c) =>
                        v.get(`${r.enrollment_id}:${c.id}`) !== null &&
                        v.get(`${r.enrollment_id}:${c.id}`) !== "",
                    ),
                )
                .map((r) => ({
                  enrollment_id: r.enrollment_id,
                  components: Object.fromEntries(
                    components.map((c) => [
                      c.id,
                      Number(v.get(`${r.enrollment_id}:${c.id}`)),
                    ]),
                  ),
                }));
              try {
                if (
                  submit &&
                  roster
                    .filter((r) => ["active", "promoted"].includes(r.status))
                    .some((r) =>
                      components.some(
                        (c) => v.get(`${r.enrollment_id}:${c.id}`) === "",
                      ),
                    )
                )
                  throw Error(
                    "Complete every student component before submitting",
                  );
                await rpc("save_marks", {
                  p_exam_subject: selected,
                  p_rows: marks,
                  p_submit: submit,
                });
                setMessage(
                  submit ? "Submitted for Admin review" : "Draft saved",
                );
                reload();
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Roll / Name</th>
                    {components.map((c) => (
                      <th key={c.id}>
                        {c.name} / {c.full_marks}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roster
                    .filter((r) => ["active", "promoted"].includes(r.status))
                    .map((r) => (
                      <tr key={r.enrollment_id}>
                        <td>
                          {r.roll} · {r.name_bn}
                        </td>
                        {components.map((c) => {
                          const m = data.subject_marks?.find(
                            (m) =>
                              m.enrollment_id === r.enrollment_id &&
                              m.submission_id === submission?.id,
                          );
                          return (
                            <td key={c.id}>
                              <input
                                aria-label={`${r.name_bn} ${c.name}`}
                                name={`${r.enrollment_id}:${c.id}`}
                                key={`${version}:${r.enrollment_id}:${c.id}`}
                                type="number"
                                step="0.01"
                                min="0"
                                max={c.full_marks}
                                disabled={!!locked || !cfg?.entry_open}
                                defaultValue={m?.components[c.id] ?? ""}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <button
              className="button"
              value="draft"
              disabled={!!locked || !cfg?.entry_open || !roster.length}
            >
              Save draft
            </button>
            <button
              className="button"
              value="submit"
              disabled={!!locked || !cfg?.entry_open || !roster.length}
            >
              Submit completed marks
            </button>
          </form>
          <h2>Submission history</h2>
          <ul>
            {data.mark_history
              ?.filter((r) => r.submission_id === submission?.id)
              .map((r) => (
                <li key={r.id}>
                  {r.action} · revision {r.revision} ·{" "}
                  {new Date(r.created_at).toLocaleString()}
                </li>
              ))}
          </ul>
          <Form
            submit="Save class attendance"
            onSubmit={async (v) => {
              await rpc("record_class_attendance", {
                p_enrollment: v.enrollment,
                p_date: v.date,
                p_status: v.status,
              });
              reload();
            }}
          >
            <Select
              name="enrollment"
              title="Student"
              items={roster.map((r) => ({
                id: r.enrollment_id,
                name: r.roll + " · " + r.name_bn,
              }))}
            />
            <Input name="date" title="Date" type="date" />
            <label>
              Status
              <select name="status">
                {["present", "absent", "late", "excused"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </Form>
        </>
      )}
      <h2>Routine and homework</h2>
      {["timetable", "homework", "teacher_attendance"].map((t) => (
        <details key={t}>
          <summary>
            {t.replaceAll("_", " ")} ({data[t]?.length || 0})
          </summary>
          {data[t]?.map((r) => (
            <p key={r.id}>
              {t === "teacher_attendance"
                ? `${r.attendance_date} · ${r.status}`
                : t === "homework"
                  ? `${r.title} · ${r.description} · ${r.due_date}`
                  : `Day ${r.weekday}: ${r.starts_at}–${r.ends_at} · ${r.room}`}
            </p>
          ))}
        </details>
      ))}
    </div>
  );
}
export function SchoolManagement() {
  const [data, setData] = useState<Record<string, Row[]>>({}),
    [tab, setTab] = useState("teachers"),
    [message, setMessage] = useState(""),
    [role, setRole] = useState(""),
    [version, setVersion] = useState(0);
  const reload = () => setVersion((n) => n + 1);
  useEffect(() => {
    let live = true;
    void (async () => {
      const result: Record<string, Row[]> = {};
      for (const t of tables) {
        result[t] = await rows(t);
      }
      const r = await rpc("school_role");
      if (live) {
        setData(result);
        setRole(r);
      }
    })().catch((e) => setMessage(e.message));
    return () => {
      live = false;
    };
  }, [version]);
  const list = (t: string) => data[t] || [];
  const act = async (name: string, args: Row) => {
    try {
      await rpc(name, args);
      setMessage("Completed / সম্পন্ন");
      reload();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const subjectLabel = (cs: Row) =>
    `${label(list("classes").find((c) => c.id === cs.class_id) || {})} · ${label(list("subjects").find((s) => s.id === cs.subject_id) || {})}`;
  const examSubjects: Row[] = list("exam_subjects").map((es) => ({
    ...es,
    name: `${label(list("exams").find((e) => e.id === es.exam_id) || {})} · ${subjectLabel(list("class_subjects").find((c) => c.id === es.class_subject_id) || {})}`,
  }));
  return (
    <div className="school-workspace">
      <h1>Academic management / একাডেমিক ব্যবস্থাপনা</h1>
      <nav className="school-tabs">
        {[
          ["teachers", "শিক্ষক / Teachers"],
          ["academics", "শ্রেণি ও বিষয় / Academics"],
          ["exams", "পরীক্ষা / Examinations"],
          ["results", "ফলাফল / Results"],
          ["students", "শিক্ষার্থী / Student history"],
          ["routines", "উপস্থিতি ও রুটিন / Attendance & routine"],
          ...(role === "super_admin"
            ? [["access", "অ্যাডমিন আমন্ত্রণ / Admin access"]]
            : []),
        ].map(([id, name]) => (
          <button
            className={tab === id ? "button" : "text-button"}
            key={id}
            onClick={() => setTab(id)}
          >
            {name}
          </button>
        ))}
      </nav>
      <Notice text={message} />
      {tab === "teachers" && (
        <>
          <h2>Teacher approval</h2>
          {list("teacher_accounts").map((t) => (
            <article className="card" key={t.id}>
              <h3>
                {t.full_name} · {t.status}
              </h3>
              <p>
                {t.designation} · {t.phone} · {t.qualification}
              </p>
              <p>Requests: {t.requested_assignments}</p>
              <p>{t.biography}</p>
              {t.photo_path && (
                <button
                  onClick={async () => {
                    const r = await db!.storage
                      .from("teacher-private")
                      .createSignedUrl(t.photo_path, 60);
                    if (r.data)
                      window.open(r.data.signedUrl, "_blank", "noopener");
                  }}
                >
                  View private photograph
                </button>
              )}
              {["approved", "rejected", "suspended", "pending"].map((s) => (
                <button
                  className="text-button"
                  key={s}
                  onClick={() =>
                    void act("update_teacher_status", {
                      p_teacher: t.id,
                      p_status: s,
                    })
                  }
                >
                  {s}
                </button>
              ))}
            </article>
          ))}
          <h2>Assign or replace a subject teacher</h2>
          <Form
            submit="Save assignment"
            onSubmit={async (v) => {
              await save(
                "teacher_assignments",
                {
                  teacher_id: v.teacher_id,
                  class_subject_id: v.class_subject_id,
                  active: v.active === "true",
                },
                "class_subject_id",
              );
              reload();
            }}
          >
            <Select
              name="teacher_id"
              title="Approved teacher"
              items={list("teacher_accounts").filter(
                (t) => t.status === "approved",
              )}
            />
            <Select
              name="class_subject_id"
              title="Class and subject"
              items={list("class_subjects").map((c) => ({
                ...c,
                name: subjectLabel(c),
              }))}
            />
            <label>
              Assignment status
              <select name="active">
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
          </Form>
          <ul>
            {list("teacher_assignments").map((a) => (
              <li key={a.id}>
                {label(
                  list("teacher_accounts").find((t) => t.id === a.teacher_id) ||
                    {},
                )}{" "}
                ·{" "}
                {subjectLabel(
                  list("class_subjects").find(
                    (c) => c.id === a.class_subject_id,
                  ) || {},
                )}{" "}
                · {a.active ? "active" : "inactive"}
              </li>
            ))}
          </ul>
        </>
      )}
      {tab === "academics" && (
        <>
          <p>
            <Link to="/admin/classes">Manage classes, sections and years</Link>
          </p>
          <Form
            submit="Add academic year"
            onSubmit={async (v) => {
              await save(
                "academic_years",
                { ...v, year: Number(v.year) },
                "year",
              );
              reload();
            }}
          >
            <Input
              name="year"
              title="Academic year"
              type="number"
              min={2000}
              max={2100}
            />
            <Input name="title" title="Year title" />
            <Input name="starts_on" title="Starts" type="date" />
            <Input name="ends_on" title="Ends" type="date" />
          </Form>
          <Form
            submit="Add subject"
            onSubmit={async (v) => {
              await save("subjects", v, "code");
              reload();
            }}
          >
            <Input name="code" title="Unique subject code" />
            <Input name="name_bn" title="বাংলা নাম" />
            <Input name="name_en" title="English name" required={false} />
          </Form>
          {list("subjects").map((s) => (
            <p key={s.id}>
              {s.code} · {s.name_bn} · {s.active ? "active" : "inactive"}{" "}
              <button
                onClick={async () => {
                  const r = await db!
                    .from("subjects")
                    .update({ active: !s.active })
                    .eq("id", s.id);
                  if (r.error) setMessage(r.error.message);
                  else reload();
                }}
              >
                Toggle active
              </button>
            </p>
          ))}
          <Form
            submit="Add subject to class"
            onSubmit={async (v) => {
              await save("class_subjects", v);
              reload();
            }}
          >
            <Select
              name="class_id"
              title="Class / section / year"
              items={list("classes").map((c) => ({
                ...c,
                name_bn: `${c.name_bn} ${c.section} · ${c.academic_year}`,
              }))}
            />
            <Select
              name="subject_id"
              title="Active subject"
              items={list("subjects").filter((s) => s.active)}
            />
          </Form>
          <GradeForm
            onSave={async (v) => {
              await save("grading_schemes", v);
              reload();
            }}
          />
        </>
      )}
      {tab === "exams" && (
        <>
          <p>
            <Link to="/admin/exams">
              Create/edit examinations for applicable classes
            </Link>
            . Create one class examination per applicable class; the same
            name/type can be used for several classes.
          </p>
          <Form
            submit="Configure exam / open or close entry"
            onSubmit={async (v) => {
              await save(
                "exam_settings",
                {
                  exam_id: v.exam_id,
                  exam_type: v.exam_type,
                  deadline: new Date(v.deadline).toISOString(),
                  entry_open: v.entry_open === "true",
                  grading_scheme_id: v.grading_scheme_id,
                },
                "exam_id",
              );
              reload();
            }}
          >
            <Select name="exam_id" title="Examination" items={list("exams")} />
            <Input
              name="exam_type"
              title="Type: Class Test, Monthly Test, Half-Yearly, Annual, Model Test or other"
              list="exam-types"
            />
            <datalist id="exam-types">
              {[
                "Class Test",
                "Monthly Test",
                "Half-Yearly",
                "Annual",
                "Model Test",
                "Other",
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </datalist>
            <Input
              name="deadline"
              title="Marks deadline (local time)"
              type="datetime-local"
            />
            <Select
              name="grading_scheme_id"
              title="Grading scheme"
              items={list("grading_schemes")}
            />
            <label>
              Entry
              <select name="entry_open">
                <option value="false">Closed</option>
                <option value="true">Open</option>
              </select>
            </label>
          </Form>
          <Form
            submit="Add examination subject"
            onSubmit={async (v) => {
              await save(
                "exam_subjects",
                {
                  ...v,
                  full_marks: Number(v.full_marks),
                  pass_marks: Number(v.pass_marks),
                },
                "exam_id,class_subject_id",
              );
              reload();
            }}
          >
            <Select name="exam_id" title="Examination" items={list("exams")} />
            <Select
              name="class_subject_id"
              title="Matching class subject"
              items={list("class_subjects").map((c) => ({
                ...c,
                name: subjectLabel(c),
              }))}
            />
            <Input
              name="full_marks"
              title="Full marks"
              type="number"
              min="0.01"
              step="0.01"
            />
            <Input
              name="pass_marks"
              title="Pass marks"
              type="number"
              min="0"
              step="0.01"
            />
          </Form>
          <Form
            submit="Add assessment component"
            onSubmit={async (v) => {
              await save(
                "assessment_components",
                {
                  ...v,
                  full_marks: Number(v.full_marks),
                },
                "exam_subject_id,name",
              );
              reload();
            }}
          >
            <Select
              name="exam_subject_id"
              title="Exam subject"
              items={examSubjects}
            />
            <Input name="name" title="Component (written, oral, practical…)" />
            <Input
              name="full_marks"
              title="Component maximum"
              type="number"
              min="0.01"
              step="0.01"
            />
          </Form>
          <p>
            Component maximums must total the subject full marks. Configuration
            locks after entry starts.
          </p>
          {examSubjects.map((es) => (
            <p key={es.id}>
              {es.name} · full {es.full_marks}, pass {es.pass_marks} ·{" "}
              {list("assessment_components")
                .filter((c) => c.exam_subject_id === es.id)
                .map((c) => `${c.name}: ${c.full_marks}`)
                .join(", ")}
            </p>
          ))}
        </>
      )}
      {tab === "results" && (
        <>
          <details>
            <summary>Admin draft marks entry / নম্বর সংশোধন</summary>
            <TeacherWorkspace administrative />
          </details>
          <h2>Review teacher submissions</h2>
          {list("mark_submissions").map((s) => (
            <article className="card" key={s.id}>
              <h3>
                {examSubjects.find((es) => es.id === s.exam_subject_id)?.name} ·{" "}
                {s.status}
              </h3>
              <p>
                Teacher:{" "}
                {
                  list("teacher_accounts").find((t) => t.id === s.teacher_id)
                    ?.full_name
                }{" "}
                · Revision {s.revision}
              </p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Roll / Student</th>
                      <th>Score</th>
                      <th>Components</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list("subject_marks")
                      .filter((m) => m.submission_id === s.id)
                      .map((m) => {
                        const en = list("enrollments").find(
                            (e) => e.id === m.enrollment_id,
                          ),
                          st = list("students").find(
                            (x) => x.id === en?.student_id,
                          );
                        return (
                          <tr key={m.id}>
                            <td>
                              {en?.roll} · {st?.name_bn}
                            </td>
                            <td>{m.score}</td>
                            <td>
                              {Object.entries(m.components)
                                .map(
                                  ([id, v]) =>
                                    `${list("assessment_components").find((c) => c.id === id)?.name}: ${v}`,
                                )
                                .join(", ")}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
              <button
                disabled={s.status !== "submitted"}
                onClick={() =>
                  void act("review_marks", {
                    p_submission: s.id,
                    p_reopen: false,
                  })
                }
              >
                Approve reviewed marks
              </button>
              <button
                onClick={() =>
                  void act("review_marks", {
                    p_submission: s.id,
                    p_reopen: true,
                  })
                }
              >
                Reopen for teacher correction
              </button>
            </article>
          ))}
          <Form
            submit="Calculate reviewed results"
            onSubmit={async (v) => {
              await rpc("calculate_exam_results", { p_exam: v.exam_id });
              reload();
            }}
          >
            <Select name="exam_id" title="Exam" items={list("exams")} />
          </Form>
          <Form
            submit="Apply publication"
            onSubmit={async (v) => {
              await rpc("publish_exam_results", {
                p_exam: v.exam_id,
                p_publish: v.publish === "true",
              });
              reload();
            }}
          >
            <Select name="exam_id" title="Exam" items={list("exams")} />
            <label>
              Publication
              <select name="publish">
                <option value="false">Unpublish</option>
                <option value="true">Publish reviewed results</option>
              </select>
            </label>
          </Form>
          <ResultReport
            sheets={list("result_sheets")}
            students={list("students")}
            enrollments={list("enrollments")}
          />
        </>
      )}
      {tab === "students" && (
        <>
          <Link to="/admin/students">Add/edit private student records</Link>
          <Form
            submit="Promote / retain into next year"
            onSubmit={async (v) => {
              await rpc("promote_student", {
                p_student: v.student_id,
                p_class: v.class_id,
                p_roll: v.roll,
              });
              reload();
            }}
          >
            <Select
              name="student_id"
              title="Student"
              items={list("students")}
            />
            <Select
              name="class_id"
              title="Next academic year class"
              items={list("classes").map((c) => ({
                ...c,
                name_bn: `${c.name_bn} ${c.section} · ${c.academic_year}`,
              }))}
            />
            <Input name="roll" title="New roll" />
          </Form>
          <Form
            submit="Save student details / exit record"
            onSubmit={async (v) => {
              await save(
                "student_details",
                { ...v, exit_date: v.exit_date || null },
                "student_id",
              );
              if (["transferred", "withdrawn", "inactive"].includes(v.status)) {
                const a = await db!
                  .from("students")
                  .update({ active: false })
                  .eq("id", v.student_id);
                if (a.error) throw a.error;
                const en = await db!
                  .from("enrollments")
                  .update({
                    status: v.status === "inactive" ? "withdrawn" : v.status,
                  })
                  .eq("student_id", v.student_id)
                  .eq("status", "active");
                if (en.error) throw en.error;
              }
              reload();
            }}
          >
            <Select
              name="student_id"
              title="Student"
              items={list("students")}
            />
            <Input name="gender" title="Gender (optional)" required={false} />
            <Input name="admission_date" title="Admission date" type="date" />
            <Input
              name="exit_date"
              title="Exit date (optional)"
              type="date"
              required={false}
            />
            <Input
              name="exit_reason"
              title="Transfer / withdrawal reason"
              required={false}
            />
            <label>
              Status
              <select name="status">
                {["active", "inactive", "transferred", "withdrawn"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </Form>
          <StudentPhotograph
            students={list("students")}
            details={list("student_details")}
            onRefresh={reload}
          />
          <h2>Academic history</h2>
          {list("enrollments").map((e) => (
            <p key={e.id}>
              {label(list("students").find((s) => s.id === e.student_id) || {})}{" "}
              · {label(list("classes").find((c) => c.id === e.class_id) || {})}{" "}
              · roll {e.roll} · {e.status}
            </p>
          ))}
        </>
      )}
      {tab === "routines" && (
        <>
          <Form
            submit="Record teacher attendance"
            onSubmit={async (v) => {
              await save("teacher_attendance", v, "teacher_id,attendance_date");
              reload();
            }}
          >
            <Select
              name="teacher_id"
              title="Teacher"
              items={list("teacher_accounts")}
            />
            <Input name="attendance_date" title="Date" type="date" />
            <label>
              Status
              <select name="status">
                {["present", "absent", "late", "excused"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </Form>
          <Form
            submit="Record student attendance"
            onSubmit={async (v) => {
              await rpc("record_class_attendance", {
                p_enrollment: v.enrollment,
                p_date: v.date,
                p_status: v.status,
              });
              reload();
            }}
          >
            <Select
              name="enrollment"
              title="Enrolled student"
              items={list("enrollments").map((e) => ({
                id: e.id,
                name: `${list("students").find((s) => s.id === e.student_id)?.name_bn} · ${list("classes").find((c) => c.id === e.class_id)?.name_bn} · ${e.roll}`,
              }))}
            />
            <Input name="date" title="Date" type="date" />
            <label>
              Status
              <select name="status">
                {["present", "absent", "late", "excused"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </Form>
          <AttendanceReport
            records={list("class_attendance")}
            enrollments={list("enrollments")}
            classes={list("classes")}
          />
          <Form
            submit="Add timetable period"
            onSubmit={async (v) => {
              await save("timetable", { ...v, weekday: Number(v.weekday) });
              reload();
            }}
          >
            <Select
              name="class_subject_id"
              title="Class subject"
              items={list("class_subjects").map((c) => ({
                ...c,
                name: subjectLabel(c),
              }))}
            />
            <label>
              Day
              <select name="weekday">
                {[
                  "Sunday",
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                ].map((s, i) => (
                  <option value={i} key={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <Input name="starts_at" title="Start" type="time" />
            <Input name="ends_at" title="End" type="time" />
            <Input name="room" title="Room" required={false} />
          </Form>
          <Form
            submit="Add homework announcement"
            onSubmit={async (v) => {
              await save("homework", v);
              reload();
            }}
          >
            <Select
              name="class_subject_id"
              title="Class subject"
              items={list("class_subjects").map((c) => ({
                ...c,
                name: subjectLabel(c),
              }))}
            />
            <Input name="title" title="Title" />
            <Input name="description" title="Description" />
            <Input name="due_date" title="Due" type="date" />
          </Form>
          <p>
            Existing calendar/events/notices remain in website content
            management. Optional routines and homework do not block marks entry.
          </p>
        </>
      )}
      {tab === "access" && role === "super_admin" && (
        <>
          <p>
            One secondary Admin slot. The owner cannot be revoked or demoted
            here. Invitations require working SMTP and verified email
            acceptance.
          </p>
          <Form
            submit="Send secondary Admin invitation"
            onSubmit={async (v) => {
              const r = await db!.functions.invoke("school-accounts", {
                body: { action: "invite_admin", email: v.email },
              });
              if (r.error) {
                const b = await r.error.context?.json?.().catch(() => null);
                throw Error(b?.error || "Invitation unavailable");
              }
              reload();
            }}
          >
            <Input
              name="email"
              title="Exact email of invited Admin"
              type="email"
            />
          </Form>
          {list("admin_invitations").map((i) => (
            <p key={i.id}>
              {i.email} · {i.status} · expires{" "}
              {new Date(i.expires_at).toLocaleString()}{" "}
              {["sending", "sent", "accepted"].includes(i.status) && (
                <button
                  onClick={() =>
                    void act("revoke_secondary_admin", { p_invitation: i.id })
                  }
                >
                  Revoke invitation / Admin access
                </button>
              )}
            </p>
          ))}
        </>
      )}
    </div>
  );
}
function GradeForm({ onSave }: { onSave: (v: Row) => Promise<void> }) {
  const [bands, setBands] = useState([{ minimum: 0, grade: "", gpa: 0 }]);
  return (
    <Form
      submit="Save grading scheme"
      onSubmit={async (v) => {
        await onSave({ name: v.name, use_gpa: v.use_gpa === "true", bands });
      }}
    >
      <h2>School-defined grading scale</h2>
      <Input name="name" title="Scheme name" />
      <label>
        GPA
        <select name="use_gpa">
          <option value="false">Not used</option>
          <option value="true">Use configured GPA</option>
        </select>
      </label>
      {bands.map((b, i) => (
        <div className="school-grid" key={i}>
          <label>
            Minimum percentage
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              required
              value={b.minimum}
              onChange={(e) =>
                setBands((a) =>
                  a.map((b, j) =>
                    i === j ? { ...b, minimum: Number(e.target.value) } : b,
                  ),
                )
              }
            />
          </label>
          <label>
            Grade label
            <input
              required
              maxLength={20}
              value={b.grade}
              onChange={(e) =>
                setBands((a) =>
                  a.map((b, j) =>
                    i === j ? { ...b, grade: e.target.value } : b,
                  ),
                )
              }
            />
          </label>
          <label>
            GPA points
            <input
              type="number"
              min={0}
              max={10}
              step="0.01"
              value={b.gpa}
              onChange={(e) =>
                setBands((a) =>
                  a.map((b, j) =>
                    i === j ? { ...b, gpa: Number(e.target.value) } : b,
                  ),
                )
              }
            />
          </label>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setBands((a) => [...a, { minimum: 0, grade: "", gpa: 0 }])
        }
      >
        Add grade band
      </button>
      <p>
        No school grading scale is assumed. Include a zero minimum and unique
        thresholds. Subject pass/fail uses each subject's pass mark; merit ties
        share the same rank.
      </p>
    </Form>
  );
}
function ResultReport({
  sheets,
  students,
  enrollments,
}: {
  sheets: Row[];
  students: Row[];
  enrollments: Row[];
}) {
  const [exam, setExam] = useState(""),
    [individual, setIndividual] = useState("");
  useEffect(() => {
    const reset = () => setIndividual("");
    window.addEventListener("afterprint", reset);
    return () => window.removeEventListener("afterprint", reset);
  }, []);
  const filtered = sheets.filter(
    (s) =>
      (!exam || s.exam_id === exam) && (!individual || s.id === individual),
  );
  return (
    <div className="school-report">
      <h2>Tabulation and marksheets</h2>
      <label className="no-print">
        Filter exam
        <select value={exam} onChange={(e) => setExam(e.target.value)}>
          <option value="">All</option>
          {[...new Set(sheets.map((s) => s.exam_id))].map((id) => (
            <option key={id} value={id}>
              {sheets.find((s) => s.exam_id === id)?.summary.exam}
            </option>
          ))}
        </select>
      </label>
      <button className="button no-print" onClick={() => window.print()}>
        Print tabulation / Save PDF
      </button>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Student / Roll</th>
              <th>Exam</th>
              <th>Marks</th>
              <th>Total / %</th>
              <th>Grade / GPA</th>
              <th>Pass / Merit</th>
              <th className="no-print">Private result code / publication</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const en = enrollments.find((e) => e.id === r.enrollment_id),
                s = students.find((s) => s.id === en?.student_id),
                v = r.summary;
              return (
                <tr key={r.id}>
                  <td>
                    {s?.name_bn} · {en?.roll}
                  </td>
                  <td>{v.exam}</td>
                  <td>
                    {v.marks
                      .map((m: Row) => `${m.subject}: ${m.score}/${m.maximum}`)
                      .join("; ")}
                  </td>
                  <td>
                    {v.total}/{v.maximum} · {v.percentage}%
                  </td>
                  <td>
                    {v.grade} {v.gpa !== null ? ` / ${v.gpa}` : ""}
                  </td>
                  <td>
                    {v.passed ? "Pass" : "Fail"} · {v.merit_position}
                  </td>
                  <td className="no-print">
                    {s?.student_code} / {r.access_code} ·{" "}
                    {r.published ? "Published" : "Private draft"}
                    <button
                      onClick={() => {
                        setExam(r.exam_id);
                        setTimeout(() => window.print(), 0);
                      }}
                    >
                      Print / PDF
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function AttendanceReport({
  records,
  enrollments,
  classes,
}: {
  records: Row[];
  enrollments: Row[];
  classes: Row[];
}) {
  return (
    <details>
      <summary>Class attendance report</summary>
      {classes.map((c) => {
        const ids = enrollments
            .filter((e) => e.class_id === c.id)
            .map((e) => e.id),
          r = records.filter((r) => ids.includes(r.enrollment_id));
        return (
          <p key={c.id}>
            {c.name_bn} {c.section} · {c.academic_year}: {r.length} records,{" "}
            {r.filter((r) => r.status === "present").length} present,{" "}
            {r.filter((r) => r.status === "absent").length} absent
          </p>
        );
      })}
    </details>
  );
}

function StudentPhotograph({
  students,
  details,
  onRefresh,
}: {
  students: Row[];
  details: Row[];
  onRefresh: () => void;
}) {
  const [student, setStudent] = useState(""),
    [message, setMessage] = useState("");
  const current = details.find((d) => d.student_id === student);
  return (
    <section className="card school-form">
      <h2>Private student photograph (optional)</h2>
      <label>
        Student
        <select value={student} onChange={(e) => setStudent(e.target.value)}>
          <option value="">Select student</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name_bn} · {s.student_code}
            </option>
          ))}
        </select>
      </label>
      <label>
        Image
        <input
          disabled={!student}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !student) return;
            try {
              const body = new FormData();
              body.set("bucket", "student-photos");
              body.set("file", file);
              const r = await db!.functions.invoke("upload", { body });
              if (r.error || r.data.error)
                throw Error("Photograph upload failed");
              await save(
                "student_details",
                { student_id: student, photo_path: r.data.path },
                "student_id",
              );
              setMessage("Photograph saved privately");
              onRefresh();
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        />
      </label>
      {current?.photo_path && (
        <button
          onClick={async () => {
            const r = await db!.storage
              .from("student-photos")
              .createSignedUrl(current.photo_path, 60);
            if (r.data) window.open(r.data.signedUrl, "_blank", "noopener");
          }}
        >
          View private photograph
        </button>
      )}
      <Notice text={message} />
    </section>
  );
}

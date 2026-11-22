import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
// Capture only the non-secret flow type before Supabase consumes callback tokens.
export const incomingAuthLinkType =
  typeof window === "undefined"
    ? null
    : new URLSearchParams(window.location.hash.slice(1)).get("type");
export const db =
  url && key
    ? createClient(url, key, {
        auth: {
          detectSessionInUrl: true,
          flowType: "pkce",
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;
export const admissionSchema = z.object({
  student_name: z.string().trim().min(2).max(120),
  guardian_name: z.string().trim().min(2).max(120),
  phone: z.string().regex(/^(?:\+?88)?01[3-9]\d{8}$/),
  email: z.union([z.email().max(254), z.literal("")]),
  birth_date: z.iso
    .date()
    .refine(
      (v) =>
        Number.isFinite(Date.parse(v)) &&
        v < new Date().toISOString().slice(0, 10),
      "Enter a valid past date",
    ),
  class_level: z.coerce.number().int().min(1).max(5),
  address: z.string().trim().min(5).max(1000),
  consent: z.literal(true),
});
export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  phone: z.string().max(20),
  message: z.string().trim().min(10).max(4000),
});
export type Lang = "bn" | "en";
export type RecordRow = { id: string; [key: string]: any };
export function safeUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:"
      ? u.href
      : undefined;
  } catch {
    return;
  }
}
export function textOf(
  row: RecordRow | undefined,
  field: string,
  lang: Lang,
): string {
  return String(
    row?.[`${field}_${lang}`] ||
      row?.[`${field}_bn`] ||
      row?.[`${field}_en`] ||
      row?.[field] ||
      "",
  );
}
export async function rows(table: string, publicOnly = false) {
  if (!db) return [];
  const records: RecordRow[] = [];
  for (let offset = 0; ; offset += 500) {
    let q = db.from(table).select("*");
    if (publicOnly) q = q.eq("published", true);
    const { data, error } = await q
      .order("created_at", { ascending: false })
      .order("id")
      .range(offset, offset + 499);
    if (error) throw new Error(error.message);
    records.push(...(data || []));
    if (!data || data.length < 500) return records;
  }
}
export async function publicCall(
  action: string,
  payload: unknown,
  captcha: string,
  protection: { company_website: string; form_started_at: number },
) {
  if (!db)
    throw new Error(
      "Database is not connected. Please try again after setup. / ডেটাবেস সংযুক্ত নেই।",
    );
  const { data, error } = await db.functions.invoke("public-api", {
    body: { action, payload, captcha, ...protection },
  });
  if (error) {
    if (error.context instanceof Response) {
      const body = await error.context.json().catch(() => null);
      if (typeof body?.error === "string")
        throw new Error(body.error.slice(0, 400));
    }
    throw new Error("Request failed. Please try again. / অনুরোধ সফল হয়নি।");
  }
  if (data?.error) throw new Error(String(data.error));
  if (data === null || data === undefined)
    throw new Error("No response received. Please try again.");
  return data;
}
export const authCaptchaEnabled =
  import.meta.env.VITE_AUTH_CAPTCHA_ENABLED === "true";
export const publicCaptchaRequired = Boolean(
  import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim(),
);
export const abuseFields = (values: Record<string, FormDataEntryValue>) => ({
  company_website: String(values.company_website || ""),
  form_started_at: Number(values.form_started_at),
});
export const localeDate = (v: string, l: Lang) =>
  new Date(v).toLocaleDateString(l === "bn" ? "bn-BD" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });
export const modules: Record<
  string,
  {
    bn: string;
    en: string;
    table: string;
    fields: string[];
    publish?: boolean;
    readonly?: boolean;
  }
> = {
  layout: {
    bn: "হোমপেজের বিভাগ ও ক্রম",
    en: "Homepage sections & order",
    table: "settings",
    fields: ["home_sections"],
  },
  homepage: {
    bn: "হোমপেজ",
    en: "Homepage",
    table: "content",
    fields: [
      "section",
      "title_bn",
      "title_en",
      "body_bn",
      "body_en",
      "image_url",
      "sort_order",
    ],
    publish: true,
  },
  school: {
    bn: "বিদ্যালয়ের তথ্য",
    en: "School information",
    table: "settings",
    fields: [
      "school_name_bn",
      "school_name_en",
      "tagline_bn",
      "tagline_en",
      "address_bn",
      "address_en",
      "phone",
      "email",
      "logo_url",
      "hero_image_url",
      "map_url",
      "facebook_url",
      "admission_open",
      "admission_requirements_bn",
      "admission_requirements_en",
      "seo_description_bn",
      "seo_description_en",
    ],
  },
  about: {
    bn: "আমাদের সম্পর্কে",
    en: "About page",
    table: "content",
    fields: [
      "section",
      "title_bn",
      "title_en",
      "body_bn",
      "body_en",
      "image_url",
      "sort_order",
    ],
    publish: true,
  },
  principal: {
    bn: "প্রধান শিক্ষকের বার্তা",
    en: "Principal message",
    table: "people",
    fields: [
      "kind",
      "name_bn",
      "name_en",
      "designation_bn",
      "designation_en",
      "bio_bn",
      "bio_en",
      "photo_url",
      "qualification_bn",
      "qualification_en",
      "subjects_bn",
      "subjects_en",
    ],
    publish: true,
  },
  teachers: {
    bn: "শিক্ষক",
    en: "Teachers",
    table: "people",
    fields: [
      "kind",
      "name_bn",
      "name_en",
      "designation_bn",
      "designation_en",
      "qualification_bn",
      "qualification_en",
      "subjects_bn",
      "subjects_en",
      "bio_bn",
      "bio_en",
      "photo_url",
    ],
    publish: true,
  },
  staff: {
    bn: "কর্মকর্তা ও কর্মচারী",
    en: "Staff",
    table: "people",
    fields: [
      "kind",
      "name_bn",
      "name_en",
      "designation_bn",
      "designation_en",
      "bio_bn",
      "bio_en",
      "photo_url",
    ],
    publish: true,
  },
  committee: {
    bn: "পরিচালনা পরিষদ",
    en: "Managing committee",
    table: "people",
    fields: [
      "kind",
      "name_bn",
      "name_en",
      "designation_bn",
      "designation_en",
      "bio_bn",
      "bio_en",
      "photo_url",
    ],
    publish: true,
  },
  classes: {
    bn: "শ্রেণি ও শাখা",
    en: "Classes & sections",
    table: "classes",
    fields: ["name_bn", "name_en", "level", "section", "academic_year"],
  },
  students: {
    bn: "শিক্ষার্থী",
    en: "Students",
    table: "students",
    fields: [
      "student_code",
      "roll",
      "name_bn",
      "name_en",
      "class_id",
      "guardian_name",
      "phone",
      "birth_date",
      "address",
      "active",
    ],
  },
  admissions: {
    bn: "ভর্তি আবেদন",
    en: "Admissions",
    table: "admissions",
    fields: [
      "student_name",
      "guardian_name",
      "phone",
      "email",
      "birth_date",
      "class_level",
      "address",
      "consent",
      "status",
      "admin_notes",
    ],
  },
  notices: {
    bn: "নোটিশ",
    en: "Notices",
    table: "notices",
    fields: [
      "title_bn",
      "title_en",
      "body_bn",
      "body_en",
      "category",
      "attachment_url",
      "pinned",
      "publish_at",
    ],
    publish: true,
  },
  exams: {
    bn: "পরীক্ষা",
    en: "Examinations",
    table: "exams",
    fields: ["name_bn", "name_en", "academic_year", "class_id", "exam_date"],
  },
  results: {
    readonly: true,
    bn: "ফলাফল",
    en: "Results",
    table: "results",
    fields: [
      "student_id",
      "exam_id",
      "marks",
      "grade",
      "published",
      "publish_at",
    ],
  },
  attendance: {
    bn: "উপস্থিতি",
    en: "Attendance",
    table: "attendance",
    fields: ["student_id", "class_id", "attendance_date", "status"],
  },
  routines: {
    bn: "ক্লাস ও পরীক্ষার রুটিন",
    en: "Routines & syllabus",
    table: "academic_documents",
    fields: [
      "title_bn",
      "title_en",
      "body_bn",
      "body_en",
      "kind",
      "class_level",
      "file_url",
    ],
    publish: true,
  },
  calendar: {
    bn: "শিক্ষাপঞ্জি",
    en: "Academic calendar",
    table: "events",
    fields: [
      "title_bn",
      "title_en",
      "body_bn",
      "body_en",
      "kind",
      "event_date",
      "image_url",
    ],
    publish: true,
  },
  gallery: {
    bn: "ছবি ও ভিডিও",
    en: "Gallery",
    table: "gallery",
    fields: [
      "title_bn",
      "title_en",
      "category",
      "media_type",
      "media_url",
      "alt_bn",
      "alt_en",
    ],
    publish: true,
  },
  news: {
    bn: "সংবাদ ও অনুষ্ঠান",
    en: "News & events",
    table: "events",
    fields: [
      "title_bn",
      "title_en",
      "body_bn",
      "body_en",
      "kind",
      "event_date",
      "image_url",
    ],
    publish: true,
  },
  downloads: {
    bn: "ডাউনলোড",
    en: "Downloads",
    table: "academic_documents",
    fields: [
      "title_bn",
      "title_en",
      "body_bn",
      "body_en",
      "kind",
      "class_level",
      "file_url",
    ],
    publish: true,
  },
  messages: {
    bn: "যোগাযোগ বার্তা",
    en: "Contact messages",
    table: "contact_messages",
    fields: ["name", "email", "phone", "message", "status"],
  },
  settings: {
    bn: "ওয়েবসাইট সেটিংস",
    en: "Website settings",
    table: "settings",
    fields: [
      "school_name_bn",
      "school_name_en",
      "tagline_bn",
      "tagline_en",
      "logo_url",
      "hero_image_url",
      "phone",
      "email",
      "address_bn",
      "address_en",
      "map_url",
      "facebook_url",
      "admission_open",
    ],
  },
  seo: {
    bn: "এসইও সেটিংস",
    en: "SEO settings",
    table: "settings",
    fields: ["seo_description_bn", "seo_description_en", "social_image_url"],
  },
  logs: {
    bn: "কার্যক্রমের ইতিহাস",
    en: "Activity logs",
    table: "activity_logs",
    fields: [],
    readonly: true,
  },
};

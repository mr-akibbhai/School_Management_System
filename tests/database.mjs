import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
);
await db.exec(
  await readFile(
    new URL(
      "../supabase/migrations/20261121214713_school.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await db.exec(
  `create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated,anon;grant all on storage.objects to authenticated,anon;`,
);
await db.exec(
  await readFile(
    new URL(
      "../supabase/migrations/20261121214718_storage.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await db.exec(
  await readFile(
    new URL(
      "../supabase/migrations/20261121214730_home_layout.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
let checks = 0;
async function role(r, fn) {
  await db.exec(`set role ${r}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
async function forbidden(sql) {
  let rejected = false;
  try {
    await db.exec(sql);
  } catch {
    rejected = true;
  }
  assert.ok(rejected, `Expected denial: ${sql}`);
  checks++;
}
await role("anon", async () => {
  assert.equal(
    (await db.query("select * from public.settings")).rows.length,
    1,
  );
  checks++;
  await forbidden("select * from public.students");
  await forbidden("select * from public.admissions");
  await forbidden("select * from public.results");
  await forbidden(`select public.lookup_result('x','x')`);
  await forbidden(`select public.track_admission('x')`);
  await forbidden(
    `insert into public.contact_messages(name,email,message) values('Test','a@b.co','Test message here')`,
  );
  await forbidden(`update public.settings set admission_open=true`);
});
await db.exec(
  `insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');insert into public.admins(user_id) values('11111111-1111-4111-8111-111111111111');`,
);
await forbidden(
  `insert into public.admins(user_id) values('22222222-2222-4222-8222-222222222222')`,
);
await db.exec(
  `select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false)`,
);
await role("authenticated", async () => {
  assert.equal(
    (await db.query("select public.is_admin() as ok")).rows[0].ok,
    false,
  );
  checks++;
  assert.equal(
    (await db.query("select * from public.students")).rows.length,
    0,
  );
  checks++;
  await forbidden(
    `insert into public.classes(name_bn,level,academic_year) values('Test',1,2026)`,
  );
  await forbidden(
    `insert into public.admins(user_id) values('22222222-2222-4222-8222-222222222222')`,
  );
  await forbidden(
    `insert into storage.objects(bucket_id,name) values('admission-documents','private.pdf')`,
  );
});
await db.exec(
  `select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false)`,
);
let classId, studentId, examId, resultCode;
await role("authenticated", async () => {
  assert.equal(
    (await db.query("select public.is_admin() as ok")).rows[0].ok,
    true,
  );
  checks++;
  await db.exec(`update public.settings set admission_open=true`);
  await db.exec(
    `insert into storage.objects(bucket_id,name) values('admission-documents','admin-private.pdf')`,
  );
  checks++;
  classId = (
    await db.query(
      `insert into public.classes(name_bn,level,academic_year) values('First',1,2026) returning id`,
    )
  ).rows[0].id;
  studentId = (
    await db.query(
      `insert into public.students(student_code,roll,name_bn,class_id,guardian_name,phone,birth_date) values('TEST-1','1','Test student',$1,'Test guardian','01712345678','2019-01-01') returning id`,
      [classId],
    )
  ).rows[0].id;
  examId = (
    await db.query(
      `insert into public.exams(name_bn,class_id,academic_year,exam_date) values('Test exam',$1,2026,'2026-11-22') returning id`,
      [classId],
    )
  ).rows[0].id;
  resultCode = (
    await db.query(
      `insert into public.results(student_id,exam_id,marks) values($1,$2,'[{"subject":"Bangla","score":80,"maximum":100}]') returning access_code`,
      [studentId, examId],
    )
  ).rows[0].access_code;
  checks++;
  await forbidden(
    `update public.results set marks='[{"subject":"Bangla","score":101,"maximum":100}]'`,
  );
  await forbidden(
    `update public.results set marks='[{"subject":"Bangla","score":null,"maximum":100}]'`,
  );
  await forbidden(`update public.results set marks='[]'`);
  await forbidden(`delete from public.activity_logs`);
  await forbidden(`update public.admins set role='super_admin'`);
  await db.exec(
    `insert into public.notices(title_bn,published,publish_at) values('Visible',true,now()),('Draft',false,now()),('Future',true,now()+interval '1 day')`,
  );
  await db.exec(
    `update public.students set name_bn='Updated name' where id='${studentId}'`,
  );
  assert.equal(
    (
      await db.query(
        `select * from public.activity_logs where table_name='students'`,
      )
    ).rows.length,
    2,
  );
  checks++;
});
await role("anon", async () => {
  const n = await db.query("select title_bn from public.notices");
  assert.deepEqual(
    n.rows.map((x) => x.title_bn),
    ["Visible"],
  );
  checks++;
});
await role("service_role", async () => {
  assert.deepEqual(
    (
      await db.query(`select public.lookup_result('TEST-1',$1) as result`, [
        resultCode,
      ])
    ).rows[0].result,
    {},
  );
  checks++;
  await db.exec("update public.results set published=true");
  const result = (
    await db.query(`select public.lookup_result('TEST-1',$1) as result`, [
      resultCode,
    ])
  ).rows[0].result;
  assert.equal(result.marks[0].score, 80);
  assert.equal(result.student_name, undefined);
  assert.equal(result.birth_date, undefined);
  checks++;
  assert.deepEqual(
    (await db.query(`select public.lookup_result('TEST-1','wrong') as result`))
      .rows[0].result,
    {},
  );
  checks++;
  await db.exec(`update public.results set publish_at=now()+interval '1 day'`);
  assert.deepEqual(
    (
      await db.query(`select public.lookup_result('TEST-1',$1) as result`, [
        resultCode,
      ])
    ).rows[0].result,
    {},
  );
  checks++;
  const payload = {
    student_name: "Test applicant",
    guardian_name: "Test guardian",
    phone: "01712345678",
    email: "",
    birth_date: "2019-01-01",
    class_level: 1,
    address: "Test address",
    consent: true,
  };
  const admission = (
    await db.query("select public.submit_admission($1) as result", [
      JSON.stringify(payload),
    ])
  ).rows[0].result;
  assert.match(admission.tracking_code, /^[a-f0-9]{32}$/);
  checks++;
  const track = (
    await db.query("select public.track_admission($1) as result", [
      admission.tracking_code,
    ])
  ).rows[0].result;
  assert.equal(track.status, "pending");
  assert.equal(track.student_name, undefined);
  checks++;
  for (let i = 0; i < 21; i++) {
    const ok = (
      await db.query(`select public.consume_rate_limit('test-ip') as ok`)
    ).rows[0].ok;
    assert.equal(ok, i < 20);
  }
  checks++;
  await db.exec("update public.settings set admission_open=false");
  await forbidden(
    `select public.submit_admission('${JSON.stringify(payload)}'::jsonb)`,
  );
});
await role("authenticated", async () => {
  const examples = [
    ["content", `title_bn,section`, `'Test content','mission'`],
    ["people", `name_bn,kind`, `'Test teacher','teacher'`],
    ["events", `title_bn,kind`, `'Test event','event'`],
    [
      "gallery",
      `title_bn,media_url`,
      `'Test image','https://example.com/test.webp'`,
    ],
    ["academic_documents", `title_bn,kind`, `'Test document','syllabus'`],
    [
      "contact_messages",
      `name,email,message`,
      `'Test sender','test@example.com','A synthetic test message.'`,
    ],
  ];
  for (const [table, columns, values] of examples) {
    const id = (
      await db.query(
        `insert into public.${table}(${columns}) values(${values}) returning id`,
      )
    ).rows[0].id;
    assert.equal(
      (await db.query(`select id from public.${table} where id=$1`, [id])).rows
        .length,
      1,
    );
    await db.query(
      `update public.${table} set created_at=created_at where id=$1`,
      [id],
    );
    assert.equal(
      (
        await db.query(`delete from public.${table} where id=$1 returning id`, [
          id,
        ])
      ).rows.length,
      1,
    );
    checks++;
  }
  await db.query(
    `insert into public.attendance(student_id,class_id,attendance_date,status) values($1,$2,'2026-11-22','present')`,
    [studentId, classId],
  );
  checks++;
  await forbidden(
    `insert into public.attendance(student_id,class_id,attendance_date,status) values('${studentId}','${classId}','2026-11-22','absent')`,
  );
  const otherClass = (
    await db.query(
      `insert into public.classes(name_bn,level,academic_year) values('Second',2,2026) returning id`,
    )
  ).rows[0].id;
  await forbidden(
    `insert into public.attendance(student_id,class_id,attendance_date,status) values('${studentId}','${otherClass}','2026-11-23','present')`,
  );
  const otherExam = (
    await db.query(
      `insert into public.exams(name_bn,class_id,academic_year,exam_date) values('Other exam',$1,2026,'2026-11-22') returning id`,
      [otherClass],
    )
  ).rows[0].id;
  await forbidden(
    `insert into public.results(student_id,exam_id,marks) values('${studentId}','${otherExam}','[{"subject":"Bangla","score":80,"maximum":100}]')`,
  );
  await db.query(
    `update public.admins set display_name='Updated administrator' where user_id='11111111-1111-4111-8111-111111111111'`,
  );
  assert.ok(
    (
      await db.query(
        `select * from public.activity_logs where table_name='admins' and action='UPDATE'`,
      )
    ).rows.length,
  );
  checks++;
  await db.query(
    `update public.settings set home_sections='["hero","notices"]'`,
  );
});
await role("anon", async () => {
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    0,
  );
  checks++;
  assert.deepEqual(
    (await db.query("select home_sections from public.settings")).rows[0]
      .home_sections,
    ["hero", "notices"],
  );
  checks++;
});
// A test-only equivalent helper lets us verify the permission cleanup locally.
await role("authenticated", async () => {
  await db.exec(
    `insert into storage.objects(bucket_id,name) values('branding','synthetic-logo.png')`,
  );
});
await db.exec(
  `select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false)`,
);
await role("authenticated", async () => {
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    0,
  );
  checks++;
  assert.equal(
    (
      await db.query(
        `delete from storage.objects where name='synthetic-logo.png' returning id`,
      )
    ).rows.length,
    0,
  );
  checks++;
  await forbidden(
    `update public.admins set user_id='22222222-2222-4222-8222-222222222222'`,
  );
  await forbidden(`delete from public.admins`);
});
await db.exec(
  `select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false)`,
);
await role("authenticated", async () => {
  assert.equal(
    (
      await db.query(
        `delete from storage.objects where name='synthetic-logo.png' returning id`,
      )
    ).rows.length,
    1,
  );
  checks++;
  assert.equal(
    (
      await db.query(
        `select * from storage.objects where bucket_id='admission-documents'`,
      )
    ).rows.length,
    1,
  );
  checks++;
});
await db.exec(
  `create function public.rls_auto_enable() returns boolean language sql security definer as $$select true$$;grant execute on function public.rls_auto_enable() to anon,authenticated;`,
);
await db.exec(
  await readFile(
    new URL(
      "../supabase/migrations/20261121220521_covering_indexes_and_event_helper_permissions.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
for (const roleName of ["anon", "authenticated"]) {
  assert.equal(
    (
      await db.query(
        `select has_function_privilege($1,'public.rls_auto_enable()','EXECUTE') as allowed`,
        [roleName],
      )
    ).rows[0].allowed,
    false,
  );
  checks++;
}
assert.equal(
  (
    await db.query(
      `select count(*)::integer as count from pg_indexes where indexname in ('attendance_class_id_idx','exams_class_id_idx')`,
    )
  ).rows[0].count,
  2,
);
checks++;
await db.close();
console.log(
  `PASS: ${checks} database authorization, privacy, integrity and rate-limit checks (PGlite; not live Supabase).`,
);

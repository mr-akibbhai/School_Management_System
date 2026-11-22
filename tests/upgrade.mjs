import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
const d = new PGlite();
await d.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated,anon;grant all on storage.objects to authenticated;`,
);
for (const f of (await readdir("supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  await d.exec(await readFile("supabase/migrations/" + f, "utf8"));
  console.log("Migration parsed/applied locally: " + f);
}

let checks = 0;
const assert = (await import("node:assert/strict")).default;
async function q(sql, args = []) {
  return (await d.query(sql, args)).rows;
}
async function value(sql, args = []) {
  return Object.values((await q(sql, args))[0])[0];
}
async function eq(sql, expected, args = []) {
  assert.deepEqual(await value(sql, args), expected, sql);
  checks++;
}
async function denied(sql, args = []) {
  let failed = false;
  try {
    await q(sql, args);
  } catch {
    failed = true;
  }
  assert.ok(failed, "Expected denial: " + sql);
  checks++;
}
async function as(id, fn) {
  await d.exec("reset role");
  await q("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await d.exec("set role authenticated");
  try {
    return await fn();
  } finally {
    await d.exec("reset role");
  }
}
const ids = Array.from(
  { length: 6 },
  (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
);
const [owner, ta, tb, pending, secondary, stranger] = ids;
for (let i = 0; i < ids.length; i++)
  await q("insert into auth.users values($1,$2,now())", [
    ids[i],
    `fixture${i}@example.test`,
  ]);
await q("insert into public.admins(user_id) values($1)", [owner]);
const teacherA = await value(
  "insert into public.teacher_accounts(user_id,full_name,phone,designation,status) values($1,'Teacher A','01700000000','Teacher','approved') returning id",
  [ta],
);
const teacherB = await value(
  "insert into public.teacher_accounts(user_id,full_name,phone,designation,status) values($1,'Teacher B','01800000000','Teacher','approved') returning id",
  [tb],
);
await q(
  "insert into public.teacher_accounts(user_id,full_name,phone,designation) values($1,'Pending Teacher','01900000000','Teacher')",
  [pending],
);
const c1 = await value(
  "insert into public.classes(name_bn,level,academic_year) values('Class 3',3,2026) returning id",
);
const c2 = await value(
  "insert into public.classes(name_bn,level,academic_year) values('Class 4',4,2026) returning id",
);
const c3 = await value(
  "insert into public.classes(name_bn,level,academic_year) values('Class 4',4,2027) returning id",
);
const subject = await value(
  "insert into public.subjects(code,name_bn) values('MATH','Mathematics') returning id",
);
const cs = await value(
  "insert into public.class_subjects(class_id,subject_id) values($1,$2) returning id",
  [c1, subject],
);
const otherCs = await value(
  "insert into public.class_subjects(class_id,subject_id) values($1,$2) returning id",
  [c2, subject],
);
await q(
  "insert into public.teacher_assignments(teacher_id,class_subject_id) values($1,$2),($3,$4)",
  [teacherA, cs, teacherB, otherCs],
);
const student = await value(
  "insert into public.students(student_code,roll,name_bn,class_id,guardian_name,phone,birth_date,address) values('FIXTURE-1','1','Synthetic Student',$1,'PRIVATE GUARDIAN','01700000000','2018-01-01','PRIVATE ADDRESS') returning id",
  [c1],
);
const enrollment = await value(
  "select id from public.enrollments where student_id=$1",
  [student],
);
const grade = await value(
  'insert into public.grading_schemes(name,use_gpa,bands) values(\'Fixture scale\',true,\'[{"minimum":0,"grade":"F","gpa":0},{"minimum":50,"grade":"P","gpa":3},{"minimum":80,"grade":"A","gpa":5}]\') returning id',
);
const exam = await value(
  "insert into public.exams(name_bn,academic_year,class_id,exam_date) values('Annual',2026,$1,current_date) returning id",
  [c1],
);
await q(
  "insert into public.exam_settings(exam_id,deadline,entry_open,grading_scheme_id) values($1,now()+interval '1 day',true,$2)",
  [exam, grade],
);
const es = await value(
  "insert into public.exam_subjects(exam_id,class_subject_id,full_marks,pass_marks) values($1,$2,100,40) returning id",
  [exam, cs],
);
const comp = await value(
  "insert into public.assessment_components(exam_subject_id,name,full_marks) values($1,'Written',100) returning id",
  [es],
);
const batch = (score) =>
  JSON.stringify([
    { enrollment_id: enrollment, components: { [comp]: score } },
  ]);
await d.exec("set role anon");
await denied("select * from public.teacher_accounts");
await denied("select public.class_roster($1)", [c1]);
await denied("select public.calculate_exam_results($1)", [exam]);
await d.exec("reset role");
await as(pending, async () => {
  await eq("select public.school_role()", "pending");
  await denied("select public.class_roster($1)", [c1]);
  await denied("update public.teacher_accounts set status='approved'");
  await denied("select public.save_marks($1,$2,false)", [es, batch(70)]);
  await eq("select count(*)::int from public.teacher_accounts", 1);
});
await as(ta, async () => {
  await eq("select public.school_role()", "teacher");
  await eq("select count(*)::int from public.teacher_accounts", 1);
  await eq("select count(*)::int from public.students", 0);
  await eq("select count(*)::int from public.enrollments", 0);
  await eq("select count(*)::int from public.class_roster($1)", 1, [c1]);
  const roster = await q("select * from public.class_roster($1)", [c1]);
  assert.deepEqual(Object.keys(roster[0]), [
    "enrollment_id",
    "student_code",
    "roll",
    "name_bn",
    "name_en",
    "status",
  ]);
  checks++;
  await denied("select public.class_roster($1)", [c2]);
  await eq(
    "with changed as(update public.teacher_assignments set teacher_id=$1 returning id) select count(*)::int from changed",
    0,
    [teacherA],
  );
  await denied("select public.update_teacher_status($1,'approved')", [
    teacherB,
  ]);
  await denied("select public.calculate_exam_results($1)", [exam]);
  await denied("select public.publish_exam_results($1,true)", [exam]);
  await denied(
    "select public.reserve_admin_invitation('illegal@example.test')",
  );
  await denied(
    "insert into public.subject_marks(submission_id,enrollment_id,components,score) values(gen_random_uuid(),$1,'{}',9)",
    [enrollment],
  );
  await denied("select public.save_marks($1,$2,false)", [es, batch(101)]);
  await denied("select public.save_marks($1,$2,false)", [es, batch(-1)]);
  await denied("select public.save_marks($1,$2,false)", [es, batch("70")]);
  await denied("select public.save_marks($1,$2,false)", [
    es,
    JSON.stringify([{ enrollment_id: enrollment, components: {} }]),
  ]);
  await denied("select public.save_marks($1,$2,false)", [
    es,
    JSON.stringify([...JSON.parse(batch(70)), ...JSON.parse(batch(70))]),
  ]);
  await q("select public.save_marks($1,$2,false)", [es, batch(85)]);
  await eq("select count(*)::int from public.subject_marks", 1);
  await q("select public.save_marks($1,$2,true)", [es, batch(85)]);
  await denied("select public.save_marks($1,$2,false)", [es, batch(90)]);
});
await as(tb, async () => {
  await denied("select public.save_marks($1,$2,false)", [es, batch(55)]);
  await eq("select count(*)::int from public.subject_marks", 0);
  await eq("select count(*)::int from public.mark_submissions", 0);
});
const submission = await value(
  "select id from public.mark_submissions where exam_subject_id=$1",
  [es],
);
await as(owner, async () => {
  await eq("select public.school_role()", "super_admin");
  await denied("select public.calculate_exam_results($1)", [exam]);
  await q("select public.review_marks($1,false)", [submission]);
  await q("select public.calculate_exam_results($1)", [exam]);
  await eq(
    "select (summary->>'percentage')::numeric from public.result_sheets",
    "85.00",
  );
  await eq("select summary->>'grade' from public.result_sheets", "A");
  await eq(
    "select (summary->>'gpa')::numeric from public.result_sheets",
    "5.00",
  );
  await eq(
    "select (summary->>'passed')::boolean from public.result_sheets",
    true,
  );
  await eq(
    "select (summary->>'merit_position')::int from public.result_sheets",
    1,
  );
  await q("select public.publish_exam_results($1,true)", [exam]);
  await denied("select public.review_marks($1,true)", [submission]);
  await q("select public.publish_exam_results($1,false)", [exam]);
  await q("select public.review_marks($1,true)", [submission]);
  await denied("select public.publish_exam_results($1,true)", [exam]);
});
await q("update public.exam_settings set entry_open=true where exam_id=$1", [
  exam,
]);
await as(ta, async () => {
  await q("select public.save_marks($1,$2,true)", [es, batch(35)]);
});
await as(owner, async () => {
  await q("select public.review_marks($1,false)", [submission]);
  await denied("select public.publish_exam_results($1,true)", [exam]);
  await q("select public.calculate_exam_results($1)", [exam]);
  await eq(
    "select (summary->>'passed')::boolean from public.result_sheets",
    false,
  );
  await q("select public.publish_exam_results($1,true)", [exam]);
});
const code = await value("select access_code from public.result_sheets");
const lookup = await value("select public.lookup_result('FIXTURE-1',$1)", [
  code,
]);
assert.ok(!JSON.stringify(lookup).includes("PRIVATE"));
assert.ok(!JSON.stringify(lookup).includes("source_versions"));
assert.equal(lookup.total, 35);
checks += 3;
await eq("select public.lookup_result('FIXTURE-1','wrong')", {});
await as(owner, async () => {
  await denied("update public.admins set role='admin'");
  await denied("delete from public.admins");
  await denied("update public.admins set user_id=$1", [stranger]);
  await denied(
    'insert into public.grading_schemes(name,bands) values(\'Invalid\',\'[{"minimum":50,"grade":"X"}]\')',
  );
  await denied(
    "insert into public.exam_subjects(exam_id,class_subject_id,full_marks,pass_marks) values($1,$2,100,30)",
    [exam, otherCs],
  );
  await denied(
    "update public.assessment_components set full_marks=90 where id=$1",
    [comp],
  );
  await denied("update public.exam_subjects set full_marks=90 where id=$1", [
    es,
  ]);
  await q("select public.record_class_attendance($1,current_date,'present')", [
    enrollment,
  ]);
  await q("select public.promote_student($1,$2,'1')", [student, c3]);
  await eq(
    "select count(*)::int from public.enrollments where student_id=$1",
    2,
    [student],
  );
  await eq("select status from public.enrollments where id=$1", "promoted", [
    enrollment,
  ]);
});
let invitation;
await as(owner, async () => {
  invitation = await value(
    "select public.reserve_admin_invitation('invited@example.test')",
  );
  await denied(
    "select public.reserve_admin_invitation('duplicate@example.test')",
  );
});
await as(stranger, async () => {
  await denied("select public.accept_admin_invitation()");
  await denied("select public.complete_admin_invitation($1,$2,true)", [
    invitation,
    secondary,
  ]);
});
await q(
  "update auth.users set email='invited@example.test',email_confirmed_at=null where id=$1",
  [secondary],
);
await q("select public.complete_admin_invitation($1,$2,true)", [
  invitation,
  secondary,
]);
await as(secondary, async () => {
  await denied("select public.accept_admin_invitation()");
});
await q("update auth.users set email_confirmed_at=now() where id=$1", [
  secondary,
]);
await as(secondary, async () => {
  await q("select public.accept_admin_invitation()");
  await eq("select public.school_role()", "admin");
  await denied(
    "select public.reserve_admin_invitation('another@example.test')",
  );
  await denied("select public.revoke_secondary_admin($1)", [invitation]);
  await denied("delete from public.admins");
  await eq("select count(*)::int from public.students", 1);
});
await as(owner, async () => {
  await q("select public.revoke_secondary_admin($1)", [invitation]);
  await eq("select public.is_super_admin()", true);
});
await as(secondary, async () => {
  await eq("select public.is_admin()", false);
  await eq("select count(*)::int from public.students", 0);
});
await as(owner, async () => {
  await q("select public.update_teacher_status($1,'suspended')", [teacherA]);
});
await as(ta, async () => {
  await eq("select public.school_role()", "suspended");
  await denied("select public.class_roster($1)", [c1]);
  await eq("select count(*)::int from public.subject_marks", 0);
});
await eq(
  "select count(*)::int from pg_tables where schemaname='public' and not rowsecurity",
  0,
);
await as(owner, async () => {
  await denied(
    'insert into public.results(student_id,exam_id,marks) values($1,$2,\'[{"subject":"X","score":10,"maximum":100}]\')',
    [student, exam],
  );
  await q(
    "insert into public.students(student_code,roll,name_bn,class_id,guardian_name,phone,birth_date) values('OPTIONAL-DOB','2','No DOB',$1,'Guardian','01700000000',null)",
    [c3],
  );
  await eq(
    "select birth_date from public.students where student_code='OPTIONAL-DOB'",
    null,
  );
  await denied(
    "insert into public.students(student_code,roll,name_bn,class_id,guardian_name,phone,birth_date) values('FUTURE-DOB','3','Invalid DOB',$1,'Guardian','01700000000',current_date+1)",
    [c3],
  );
});
await eq(
  "select count(*)::int from public.activity_logs where action='ADMIN_INVITATION_ACCEPTED'",
  1,
);
await eq(
  "select count(*)::int from public.activity_logs where action='SECONDARY_ADMIN_REVOKED'",
  1,
);
await eq(
  "select count(*)::int from public.activity_logs where action='TEACHER_SUSPENDED'",
  1,
);
await d.exec("set role anon");
await eq("select count(*)::int from public.public_academic_catalog()", 2);
await d.exec("reset role");
await as(owner, async () => {
  await denied("update public.enrollments set class_id=$1 where id=$2", [
    c2,
    enrollment,
  ]);
  await denied("update public.exams set class_id=$1 where id=$2", [c2, exam]);
  await denied("update public.class_subjects set class_id=$1 where id=$2", [
    c3,
    cs,
  ]);
});
const withdrawStudent = await value(
  "insert into public.students(student_code,roll,name_bn,class_id,guardian_name,phone) values('WITHDRAWN','1','Withdrawn fixture',$1,'Guardian','01700000000') returning id",
  [c2],
);
const remainStudent = await value(
  "insert into public.students(student_code,roll,name_bn,class_id,guardian_name,phone) values('REMAINING','2','Remaining fixture',$1,'Guardian','01700000000') returning id",
  [c2],
);
const we = await value(
    "select id from public.enrollments where student_id=$1",
    [withdrawStudent],
  ),
  re = await value("select id from public.enrollments where student_id=$1", [
    remainStudent,
  ]);
const exam2 = await value(
  "insert into public.exams(name_bn,academic_year,class_id,exam_date) values('Withdrawal test',2026,$1,current_date) returning id",
  [c2],
);
await q(
  "insert into public.exam_settings(exam_id,deadline,entry_open,grading_scheme_id) values($1,now()+interval '1 day',true,$2)",
  [exam2, grade],
);
const es2 = await value(
  "insert into public.exam_subjects(exam_id,class_subject_id,full_marks,pass_marks) values($1,$2,100,40) returning id",
  [exam2, otherCs],
);
const comp2 = await value(
  "insert into public.assessment_components(exam_subject_id,name,full_marks) values($1,'Written',100) returning id",
  [es2],
);
await as(tb, async () => {
  await q("select public.save_marks($1,$2,false)", [
    es2,
    JSON.stringify([
      { enrollment_id: we, components: { [comp2]: 60 } },
      { enrollment_id: re, components: { [comp2]: 75 } },
    ]),
  ]);
});
await q("update public.enrollments set status='withdrawn' where id=$1", [we]);
await as(tb, async () => {
  await denied("select public.save_marks($1,$2,false)", [
    es2,
    JSON.stringify([{ enrollment_id: we, components: { [comp2]: 90 } }]),
  ]);
  await q("select public.save_marks($1,$2,true)", [
    es2,
    JSON.stringify([{ enrollment_id: re, components: { [comp2]: 75 } }]),
  ]);
  await eq(
    "select status from public.mark_submissions where exam_subject_id=$1",
    "submitted",
    [es2],
  );
});
console.log(
  `PASS: ${checks} upgrade authorization, invitation, marks, calculation, publication and privacy checks (isolated PGlite).`,
);
await d.close();

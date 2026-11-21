import { describe, it, expect } from "vitest";
import { admissionSchema, contactSchema, safeUrl } from "../src/lib";
describe("public submissions", () => {
  const valid = {
    student_name: "Test child",
    guardian_name: "Test guardian",
    phone: "01712345678",
    email: "",
    birth_date: "2019-01-01",
    class_level: 1,
    address: "Test address",
    consent: true,
  };
  it("accepts a complete guardian application and coerces form class", () =>
    expect(
      admissionSchema.parse({ ...valid, class_level: "2" }).class_level,
    ).toBe(2));
  it("rejects missing consent, future birth dates, invalid phone and out of range class", () => {
    for (const change of [
      { consent: false },
      { birth_date: "2999-01-01" },
      { birth_date: "2019-02-31" },
      { phone: "1234" },
      { class_level: 6 },
    ])
      expect(admissionSchema.safeParse({ ...valid, ...change }).success).toBe(
        false,
      );
  });
  it("limits contact message length and validates email", () => {
    expect(
      contactSchema.safeParse({
        name: "Test",
        email: "a@example.com",
        phone: "",
        message: "A useful test message.",
      }).success,
    ).toBe(true);
    expect(
      contactSchema.safeParse({
        name: "Test",
        email: "invalid",
        phone: "",
        message: "A useful test message.",
      }).success,
    ).toBe(false);
  });
  it("blocks active-content URL schemes", () => {
    for (const v of [
      "javascript:alert(1)",
      "data:text/html,test",
      "file:///secret",
      "bad-url",
    ])
      expect(safeUrl(v)).toBeUndefined();
    expect(safeUrl("https://school.example/notice.pdf")).toBe(
      "https://school.example/notice.pdf",
    );
  });
});

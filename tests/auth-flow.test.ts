import { describe, expect, it } from "vitest";
import { authCallbackOptions } from "../src/auth-flow";

describe("invitation callback compatibility", () => {
  it("uses PKCE for ordinary visits", () => {
    expect(authCallbackOptions("")).toEqual({
      flowType: "pkce",
      invitation: false,
    });
  });
  it("accepts the dashboard invitation callback without a nonexistent PKCE verifier", () => {
    expect(
      authCallbackOptions(
        "#type=invite&access_token=test-access&refresh_token=test-refresh",
      ),
    ).toEqual({ flowType: "implicit", invitation: true });
  });
  it("does not treat a type-only fragment as an invitation session", () => {
    expect(authCallbackOptions("#type=invite").invitation).toBe(false);
  });
  it("does not downgrade parsing for incomplete credentials", () => {
    for (const hash of [
      "#type=invite&access_token=test",
      "#type=invite&refresh_token=test",
      "#type=invite&access_token=&refresh_token=test",
    ])
      expect(authCallbackOptions(hash).flowType).toBe("pkce");
  });
  it("retains PKCE for password recovery and unrelated callbacks", () => {
    for (const type of ["recovery", "signup", "magiclink", "other"])
      expect(
        authCallbackOptions(
          `#type=${type}&access_token=test&refresh_token=test`,
        ).flowType,
      ).toBe("pkce");
  });
  it("does not accept error-bearing fragments as valid invitations", () => {
    expect(
      authCallbackOptions(
        "#type=invite&access_token=test&refresh_token=test&error_code=otp_expired",
      ).invitation,
    ).toBe(false);
  });
  it("never returns callback credentials", () => {
    expect(
      Object.keys(
        authCallbackOptions(
          "#type=invite&access_token=test&refresh_token=test",
        ),
      ),
    ).toEqual(["flowType", "invitation"]);
  });
});

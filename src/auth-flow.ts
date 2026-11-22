// Dashboard invitations contain an implicit callback: unlike recovery requests
// initiated by this app, they cannot carry this browser's PKCE verifier.
// This selects SDK parsing only; Supabase still validates the signed-in user.
export function authCallbackOptions(hash: string): {
  flowType: "implicit" | "pkce";
  invitation: boolean;
} {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const invitation =
    params.get("type") === "invite" &&
    !!params.get("access_token") &&
    !!params.get("refresh_token") &&
    !params.has("error") &&
    !params.has("error_code");
  return { flowType: invitation ? "implicit" : "pkce", invitation };
}

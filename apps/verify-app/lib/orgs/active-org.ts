/** HttpOnly cookie set when the user selects an org (see orgs.actions). */
export const ACTIVE_ORG_COOKIE = "ox_org";

export function getActiveOrgIdFromCookies(cookieStore: { get: (name: string) => { value: string } | undefined }): string | null {
  const v = cookieStore.get(ACTIVE_ORG_COOKIE)?.value?.trim();
  return v && v.length > 0 ? v : null;
}

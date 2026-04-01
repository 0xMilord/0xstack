import { auth } from "@/lib/auth/auth";

export async function authService_signOut(headers: Headers) {
  // Better Auth handles cookie/session clearing.
  return await auth.api.signOut({ headers });
}

import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** All signed-in accounts are admins (see `admins` table). */
export type AppRole = "admin";

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: AppRole;
};

type JwtPayload = SessionUser & {
  iat: number;
  exp: number;
};

const AUTH_COOKIE = "erp_session";
const MAX_AGE_SECONDS = 60 * 60 * 8;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing required environment variable: JWT_SECRET");
  }
  return secret;
}

export function createSessionToken(user: SessionUser): string {
  return jwt.sign(user, getJwtSecret(), { expiresIn: MAX_AGE_SECONDS });
}

export function verifySessionToken(token: string): SessionUser | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
    return {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) {
    return null;
  }
  return verifySessionToken(token);
}

export type RequireAuthResult =
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse };

/** Any signed-in user (inventory and most ERP modules). */
export async function requireAuth(): Promise<RequireAuthResult> {
  const user = await getSessionUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ message: "Unauthorized." }, { status: 401 }),
    };
  }
  return { ok: true, user };
}

export const authCookieConfig = {
  name: AUTH_COOKIE,
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  },
};

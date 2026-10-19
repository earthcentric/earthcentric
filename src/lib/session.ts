import { cookies } from "next/headers";
import {
  EARTHCENTRIC_SESSION_COOKIE,
  signEarthcentricSession,
} from "@/lib/session-token";

interface SessionClaims {
  id: string;
  role: string;
  sellerStatus?: string;
}

const SESSION_TTL_SECONDS = 8 * 60 * 60;

export async function setEarthcentricSessionCookie(claims: SessionClaims): Promise<void> {
  const cookieStore = await cookies();
  const token = await signEarthcentricSession(claims);
  cookieStore.set(EARTHCENTRIC_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

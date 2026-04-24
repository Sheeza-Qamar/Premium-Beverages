import { authCookieConfig } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ message: "Logged out." });
  response.cookies.set(authCookieConfig.name, "", {
    ...authCookieConfig.options,
    maxAge: 0,
  });
  return response;
}

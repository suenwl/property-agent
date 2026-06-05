import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, SESSION_DURATION } from "@/lib/auth";

export async function POST(request: Request) {
  const { username, password } = await request.json();

  const validUsername = process.env.AUTH_USERNAME;
  const validPassword = process.env.AUTH_PASSWORD;

  if (
    !validUsername ||
    !validPassword ||
    username !== validUsername ||
    password !== validPassword
  ) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  const token = await createSessionToken();

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_DURATION,
    path: "/",
  });

  return response;
}

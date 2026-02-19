import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/profile?emailError=invalid", request.url));
  }

  const user = await db.query.users.findFirst({
    where: eq(users.emailVerifyToken, token),
  });

  if (!user) {
    return NextResponse.redirect(new URL("/profile?emailError=invalid", request.url));
  }

  if (user.emailVerifyExpiresAt! < Date.now()) {
    return NextResponse.redirect(new URL("/profile?emailError=expired", request.url));
  }

  await db
    .update(users)
    .set({
      email: user.pendingEmail,
      pendingEmail: null,
      emailVerifyToken: null,
      emailVerifyExpiresAt: null,
    })
    .where(eq(users.id, user.id));

  return NextResponse.redirect(new URL("/profile?emailVerified=1", request.url));
}

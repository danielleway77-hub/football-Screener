import { NextResponse } from "next/server";

/** Step 4: pass-through. Step 6 adds the JWT check (thin and stateless; no DB here). */
export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|robots.txt|icons/).*)",
  ],
};

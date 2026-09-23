import { NextResponse } from "next/server";

export function healthOk() {
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";

const ANALYSE_BASE_URL = process.env.ANALYSE_BASE_URL ?? process.env.NEXT_PUBLIC_ANALYSE_BASE_URL;

export async function POST(req: NextRequest) {
  if (!ANALYSE_BASE_URL) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const forwardedFor = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const upstream = await fetch(`${ANALYSE_BASE_URL.replace(/\/$/, "")}/api/public/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": forwardedFor },
    body: JSON.stringify(body),
  }).catch(() => null);

  if (!upstream) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

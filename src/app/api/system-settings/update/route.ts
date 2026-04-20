import { NextRequest, NextResponse } from "next/server";
import { setSetting } from "@/lib/system-settings";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await setSetting(key, String(value));

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { sendLgTvToast, isLgTvPaired } from "@/lib/lg-tv";

export async function POST(request: NextRequest) {
    let body: { ip: string; message?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.ip || typeof body.ip !== "string") {
        return NextResponse.json({ error: "ip is required" }, { status: 400 });
    }

    const ip = body.ip.trim();

    if (!isLgTvPaired(ip)) {
        return NextResponse.json(
            { error: "TV not paired — use the Pair button first" },
            { status: 409 }
        );
    }

    const message = body.message?.trim() || "Trade Alert: This is a test notification from Trade Alert Speaker.";
    const sent = await sendLgTvToast(ip, message);

    if (!sent) {
        return NextResponse.json(
            { error: "TV unreachable — is it on?" },
            { status: 502 }
        );
    }

    return NextResponse.json({ sent: true, ip, message });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await prisma.message.count();
        return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ status: "error", error: message }, { status: 503 });
    }
}

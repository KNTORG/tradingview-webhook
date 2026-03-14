import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SECRET_KEY = "webhook_secret";
const PUBLIC_URL_KEY = "public_url";
const TIMEZONE_KEY = "timezone";

export async function GET() {
    try {
        const settings = await prisma.appSetting.findMany({
            where: {
                key: { in: [SECRET_KEY, PUBLIC_URL_KEY, TIMEZONE_KEY] }
            }
        });

        const secret = settings.find(s => s.key === SECRET_KEY)?.value || process.env.WEBHOOK_SECRET || "";
        const publicUrl = settings.find(s => s.key === PUBLIC_URL_KEY)?.value || "";
        const timezone = settings.find(s => s.key === TIMEZONE_KEY)?.value || process.env.TZ || "Asia/Bangkok";

        return NextResponse.json({ secret, publicUrl, timezone });
    } catch (e) {
        console.error("Failed to fetch settings:", e);
        return NextResponse.json({
            secret: process.env.WEBHOOK_SECRET || "",
            publicUrl: "",
            timezone: process.env.TZ || "Asia/Bangkok",
        });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { secret, publicUrl } = body;

        if (secret !== undefined) {
            if (!secret.trim()) {
                return NextResponse.json({ success: false, error: "Secret cannot be empty" }, { status: 400 });
            }
            await prisma.appSetting.upsert({
                where: { key: SECRET_KEY },
                update: { value: secret.trim() },
                create: { key: SECRET_KEY, value: secret.trim() },
            });
            process.env.WEBHOOK_SECRET = secret.trim();
        }

        if (publicUrl !== undefined) {
            await prisma.appSetting.upsert({
                where: { key: PUBLIC_URL_KEY },
                update: { value: publicUrl.trim() },
                create: { key: PUBLIC_URL_KEY, value: publicUrl.trim() },
            });
        }

        if (body.timezone !== undefined) {
            await prisma.appSetting.upsert({
                where: { key: TIMEZONE_KEY },
                update: { value: body.timezone.trim() },
                create: { key: TIMEZONE_KEY, value: body.timezone.trim() },
            });
            process.env.TZ = body.timezone.trim();
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("Failed to save settings:", e);
        return NextResponse.json({ success: false, error: "Failed to save settings" }, { status: 500 });
    }
}

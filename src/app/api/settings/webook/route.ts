import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SECRET_KEY = "webhook_secret";
const PUBLIC_URL_KEY = "public_url";

export async function GET() {
    try {
        const settings = await prisma.appSetting.findMany({
            where: {
                key: { in: [SECRET_KEY, PUBLIC_URL_KEY] }
            }
        });
        
        const secret = settings.find(s => s.key === SECRET_KEY)?.value || process.env.WEBHOOK_SECRET || "";
        const publicUrl = settings.find(s => s.key === PUBLIC_URL_KEY)?.value || "";
        
        return NextResponse.json({ secret, publicUrl });
    } catch (e) {
        console.error("Failed to fetch settings:", e);
        return NextResponse.json({ 
            secret: process.env.WEBHOOK_SECRET || "", 
            publicUrl: "" 
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

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("Failed to save settings:", e);
        return NextResponse.json({ success: false, error: "Failed to save settings" }, { status: 500 });
    }
}

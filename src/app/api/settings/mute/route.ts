import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { MuteWindow } from "@/types/settings";

const MUTE_WINDOWS_KEY = "mute_windows";

export async function GET() {
    try {
        const setting = await prisma.appSetting.findUnique({
            where: { key: MUTE_WINDOWS_KEY },
        });
        const windows: MuteWindow[] = setting?.value
            ? JSON.parse(setting.value)
            : [];
        return NextResponse.json({ windows });
    } catch (e) {
        console.error("Failed to fetch mute windows:", e);
        return NextResponse.json({ windows: [] });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const input = body?.windows;

        if (!Array.isArray(input)) {
            return NextResponse.json(
                { success: false, error: "windows must be an array" },
                { status: 400 }
            );
        }

        const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
        const windows: MuteWindow[] = [];

        for (const w of input) {
            const dayOfWeek = Number(w?.dayOfWeek);
            if (!Number.isInteger(dayOfWeek) || dayOfWeek < -1 || dayOfWeek > 6) {
                return NextResponse.json(
                    { success: false, error: "dayOfWeek must be -1 to 6" },
                    { status: 400 }
                );
            }
            if (!timeRegex.test(w?.startTime) || !timeRegex.test(w?.endTime)) {
                return NextResponse.json(
                    { success: false, error: "startTime and endTime must be in HH:mm format" },
                    { status: 400 }
                );
            }
            windows.push({
                id: typeof w.id === "string" && w.id ? w.id : crypto.randomUUID(),
                dayOfWeek,
                startTime: w.startTime,
                endTime: w.endTime,
                enabled: w.enabled !== false,
            });
        }

        const value = JSON.stringify(windows);
        await prisma.appSetting.upsert({
            where: { key: MUTE_WINDOWS_KEY },
            update: { value },
            create: { key: MUTE_WINDOWS_KEY, value },
        });

        return NextResponse.json({ success: true, windows });
    } catch (e) {
        console.error("Failed to save mute windows:", e);
        return NextResponse.json(
            { success: false, error: "Failed to save mute windows" },
            { status: 500 }
        );
    }
}

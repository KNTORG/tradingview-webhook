import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rangesOverlap } from "@/lib/schedule";

export async function GET() {
    const schedules = await prisma.speakerSchedule.findMany({
        orderBy: [{ speakerName: "asc" }, { dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    // Group by speaker
    const grouped: Record<
        string,
        {
            speakerName: string;
            speakerIp: string | null;
            rules: typeof schedules;
        }
    > = {};

    for (const s of schedules) {
        if (!grouped[s.speakerName]) {
            grouped[s.speakerName] = {
                speakerName: s.speakerName,
                speakerIp: s.speakerIp,
                rules: [],
            };
        } else if (!grouped[s.speakerName].speakerIp && s.speakerIp) {
            // Pick a non-null IP if the first one was null
            grouped[s.speakerName].speakerIp = s.speakerIp;
        }
        grouped[s.speakerName].rules.push(s);
    }

    return NextResponse.json({ speakers: Object.values(grouped) });
}

export async function POST(request: NextRequest) {
    let body: {
        speakerName: string;
        speakerIp?: string;
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        enabled?: boolean;
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 }
        );
    }

    // Validate
    if (!body.speakerName || typeof body.speakerName !== "string") {
        return NextResponse.json(
            { error: "speakerName is required" },
            { status: 400 }
        );
    }

    if (body.dayOfWeek < -1 || body.dayOfWeek > 6) {
        return NextResponse.json(
            { error: "dayOfWeek must be -1 to 6" },
            { status: 400 }
        );
    }

    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRegex.test(body.startTime) || !timeRegex.test(body.endTime)) {
        return NextResponse.json(
            { error: "startTime and endTime must be in HH:mm format" },
            { status: 400 }
        );
    }

    // Check for overlaps
    const existingSchedules = await prisma.speakerSchedule.findMany({
        where: {
            speakerName: body.speakerName,
            dayOfWeek: body.dayOfWeek,
        },
    });

    for (const s of existingSchedules) {
        if (rangesOverlap(body.startTime, body.endTime, s.startTime, s.endTime)) {
            return NextResponse.json(
                {
                    error: `Time range overlaps with an existing schedule (${s.startTime} - ${s.endTime})`,
                },
                { status: 400 }
            );
        }
    }

    const schedule = await prisma.speakerSchedule.create({
        data: {
            speakerName: body.speakerName,
            speakerIp: body.speakerIp || null,
            dayOfWeek: body.dayOfWeek,
            startTime: body.startTime,
            endTime: body.endTime,
            enabled: body.enabled ?? true,
        },
    });

    return NextResponse.json(schedule, { status: 201 });
}

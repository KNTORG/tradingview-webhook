import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rangesOverlap } from "@/lib/schedule";

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    let body: {
        speakerIp?: string;
        dayOfWeek?: number;
        startTime?: string;
        endTime?: string;
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

    const existing = await prisma.speakerSchedule.findUnique({
        where: { id },
    });

    if (!existing) {
        return NextResponse.json(
            { error: "Schedule not found" },
            { status: 404 }
        );
    }

    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (body.startTime && !timeRegex.test(body.startTime)) {
        return NextResponse.json(
            { error: "startTime must be in HH:mm format" },
            { status: 400 }
        );
    }
    if (body.endTime && !timeRegex.test(body.endTime)) {
        return NextResponse.json(
            { error: "endTime must be in HH:mm format" },
            { status: 400 }
        );
    }
    if (
        body.dayOfWeek !== undefined &&
        (body.dayOfWeek < -1 || body.dayOfWeek > 6)
    ) {
        return NextResponse.json(
            { error: "dayOfWeek must be -1 to 6" },
            { status: 400 }
        );
    }

    // Check for overlaps
    const newDay = body.dayOfWeek ?? existing.dayOfWeek;
    const newStart = body.startTime ?? existing.startTime;
    const newEnd = body.endTime ?? existing.endTime;

    const otherSchedules = await prisma.speakerSchedule.findMany({
        where: {
            speakerName: existing.speakerName,
            dayOfWeek: newDay,
            id: { not: id },
        },
    });

    for (const s of otherSchedules) {
        if (rangesOverlap(newStart, newEnd, s.startTime, s.endTime)) {
            return NextResponse.json(
                {
                    error: `Time range overlaps with an existing schedule (${s.startTime} - ${s.endTime})`,
                },
                { status: 400 }
            );
        }
    }

    const updated = await prisma.speakerSchedule.update({
        where: { id },
        data: {
            ...(body.speakerIp !== undefined && { speakerIp: body.speakerIp }),
            ...(body.dayOfWeek !== undefined && { dayOfWeek: body.dayOfWeek }),
            ...(body.startTime !== undefined && { startTime: body.startTime }),
            ...(body.endTime !== undefined && { endTime: body.endTime }),
            ...(body.enabled !== undefined && { enabled: body.enabled }),
        },
    });

    return NextResponse.json(updated);
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const existing = await prisma.speakerSchedule.findUnique({
        where: { id },
    });

    if (!existing) {
        return NextResponse.json(
            { error: "Schedule not found" },
            { status: 404 }
        );
    }

    await prisma.speakerSchedule.delete({ where: { id } });

    return NextResponse.json({ deleted: true });
}

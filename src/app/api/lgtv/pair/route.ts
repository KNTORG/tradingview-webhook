import { NextRequest, NextResponse } from "next/server";
import { pairLgTv, isLgTvPaired } from "@/lib/lg-tv";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
    let body: { ip: string; name: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.ip || typeof body.ip !== "string") {
        return NextResponse.json({ error: "ip is required" }, { status: 400 });
    }
    if (!body.name || typeof body.name !== "string") {
        return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const ip = body.ip.trim();
    const name = body.name.trim();

    try {
        await pairLgTv(ip); // waits up to 60 s for user to accept on TV
    } catch (err) {
        const message = err instanceof Error ? err.message : "Pairing failed";
        return NextResponse.json({ error: message }, { status: 502 });
    }

    // Create default Mon–Sun schedules if none exist yet for this TV
    const existing = await prisma.speakerSchedule.count({
        where: { speakerName: name, channelType: "lgtv" },
    });

    if (existing === 0) {
        for (let day = 0; day <= 6; day++) {
            await prisma.speakerSchedule.create({
                data: {
                    speakerName: name,
                    speakerIp: ip,
                    channelType: "lgtv",
                    dayOfWeek: day,
                    startTime: "08:00",
                    endTime: "22:00",
                    enabled: true,
                },
            });
        }
    }

    return NextResponse.json({ paired: true, name, ip });
}

export async function GET(request: NextRequest) {
    const ip = request.nextUrl.searchParams.get("ip");
    if (!ip) {
        return NextResponse.json({ error: "ip query param required" }, { status: 400 });
    }
    return NextResponse.json({ ip, paired: isLgTvPaired(ip) });
}

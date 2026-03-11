import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSpeakers } from "@/lib/schedule";
import { castToSpeaker } from "@/lib/google-home";
import { addToRetryQueue } from "@/lib/retry-queue";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ secret: string }> }
) {
    const { secret } = await params;

    // Read secret from DB first, fall back to env var
    let expectedSecret = process.env.WEBHOOK_SECRET;
    try {
        const dbSetting = await prisma.appSetting.findUnique({ where: { key: "webhook_secret" } });
        if (dbSetting?.value) expectedSecret = dbSetting.value;
    } catch {
        // If DB lookup fails, keep using env var
    }

    if (!expectedSecret || secret !== expectedSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let text: string | undefined;
    const contentType = request.headers.get("content-type") || "";
    const rawBody = await request.text();

    if (contentType.includes("application/json")) {
        try {
            const jsonBody = JSON.parse(rawBody);
            text = typeof jsonBody.text === "string" ? jsonBody.text : rawBody;
        } catch {
            text = rawBody;
        }
    } else {
        text = rawBody;
    }

    if (!text || text.trim().length === 0) {
        return NextResponse.json(
            { error: 'Body is empty or missing "text" field' },
            { status: 400 }
        );
    }

    // Store message
    const message = await prisma.message.create({
        data: {
            text,
            status: "pending",
            speakers: "[]",
        },
    });

    // Find active speakers
    const activeSpeakers = await getActiveSpeakers();

    if (activeSpeakers.length === 0) {
        // No speakers active — silently log
        await prisma.message.update({
            where: { id: message.id },
            data: { status: "silenced", speakers: "[]" },
        });

        return NextResponse.json({
            id: message.id,
            status: "silenced",
            speakers: [],
            message: "No speakers active at current time",
        });
    }

    // Cast to all active speakers in parallel
    const castPromises = activeSpeakers.map(async (speaker) => {
        try {
            await castToSpeaker(speaker.speakerName, text, speaker.speakerIp);
            return { speakerName: speaker.speakerName, success: true };
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Unknown error";
            console.error(`Failed to cast to ${speaker.speakerName}:`, errorMsg);

            // Add to retry queue
            addToRetryQueue({
                messageId: message.id,
                text,
                speakerName: speaker.speakerName,
                speakerIp: speaker.speakerIp,
                attempts: 0
            });
            return { speakerName: speaker.speakerName, success: false, error: errorMsg };
        }
    });

    const results = await Promise.all(castPromises);
    const successSpeakers = results.filter(r => r.success).map(r => r.speakerName);
    const errors = results.filter(r => !r.success).map(r => `${r.speakerName}: ${r.error}`);

    const finalStatus =
        successSpeakers.length > 0
            ? "spoken"
            : (activeSpeakers.length > 0 ? "failed" : "silenced");

    await prisma.message.update({
        where: { id: message.id },
        data: {
            status: finalStatus,
            speakers: JSON.stringify(successSpeakers),
            error: errors.length > 0 ? errors.join("; ") : null,
        },
    });

    return NextResponse.json({
        id: message.id,
        status: finalStatus,
        speakers: successSpeakers,
        errors: errors.length > 0 ? errors : undefined,
    });
}

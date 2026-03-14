import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSpeakers } from "@/lib/schedule";
import { castToSpeaker } from "@/lib/google-home";
import { addToRetryQueue } from "@/lib/retry-queue";
import { notifyClients } from "@/lib/sse-clients";

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

    // Process casting in background so TradingView gets an instant response
    // (TradingView times out after ~10s; casting takes 10-30s)
    processWebhookInBackground(message.id, text);

    return NextResponse.json({
        id: message.id,
        status: "pending",
        message: "Alert received, processing in background",
    });
}

function processWebhookInBackground(messageId: string, text: string) {
    (async () => {
        try {
            const activeSpeakers = await getActiveSpeakers();

            if (activeSpeakers.length === 0) {
                await prisma.message.update({
                    where: { id: messageId },
                    data: { status: "silenced", speakers: "[]" },
                });
                notifyClients();
                return;
            }

            const results = await Promise.all(
                activeSpeakers.map(async (speaker) => {
                    try {
                        await castToSpeaker(speaker.speakerName, text, speaker.speakerIp);
                        return { speakerName: speaker.speakerName, success: true };
                    } catch (err) {
                        const errorMsg = err instanceof Error ? err.message : "Unknown error";
                        console.error(`Failed to cast to ${speaker.speakerName}:`, errorMsg);
                        addToRetryQueue({
                            messageId,
                            text,
                            speakerName: speaker.speakerName,
                            speakerIp: speaker.speakerIp,
                            attempts: 0,
                        });
                        return { speakerName: speaker.speakerName, success: false, error: errorMsg };
                    }
                })
            );

            const successSpeakers = results.filter((r) => r.success).map((r) => r.speakerName);
            const errors = results.filter((r) => !r.success).map((r) => `${r.speakerName}: ${r.error}`);
            const finalStatus = successSpeakers.length > 0 ? "spoken" : "failed";

            await prisma.message.update({
                where: { id: messageId },
                data: {
                    status: finalStatus,
                    speakers: JSON.stringify(successSpeakers),
                    error: errors.length > 0 ? errors.join("; ") : null,
                },
            });
            notifyClients();
        } catch (err) {
            console.error("Background webhook processing failed:", err);
            await prisma.message.update({
                where: { id: messageId },
                data: { status: "failed", error: String(err) },
            }).catch(() => {});
        }
    })();
}

import { NextRequest, NextResponse } from "next/server";
import { castToSpeaker } from "@/lib/google-home";

export async function POST(request: NextRequest) {
    let body: { speakerName: string; speakerIp?: string; text?: string };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 }
        );
    }

    if (!body.speakerName) {
        return NextResponse.json(
            { error: "speakerName is required" },
            { status: 400 }
        );
    }

    const text = body.text || "This is a test message from Trade Alert Speaker.";

    try {
        await castToSpeaker(body.speakerName, text, body.speakerIp);
        return NextResponse.json({
            success: true,
            message: `Test message sent to "${body.speakerName}"`,
        });
    } catch (err) {
        const errorMsg =
            err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json(
            { success: false, error: errorMsg },
            { status: 500 }
        );
    }
}

import { NextResponse } from "next/server";
import { discoverSpeakers } from "@/lib/google-home";

export async function GET() {
    try {
        const speakers = await discoverSpeakers(5000);

        return NextResponse.json({
            speakers,
            message:
                speakers.length === 0
                    ? "No speakers found. Make sure the app is on the same network as your Google Home devices."
                    : `Found ${speakers.length} speaker(s)`,
        });
    } catch (err) {
        const errorMsg =
            err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json(
            { error: `Discovery failed: ${errorMsg}`, speakers: [] },
            { status: 500 }
        );
    }
}

import { addClient, removeClient } from "@/lib/sse-clients";

export const dynamic = "force-dynamic";

export async function GET() {
    const stream = new ReadableStream({
        start(controller) {
            // Send initial heartbeat so client knows connection is live
            controller.enqueue(new TextEncoder().encode(": heartbeat\n\n"));
            addClient(controller);
        },
        cancel(controller) {
            removeClient(controller);
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}

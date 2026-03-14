const clients = new Set<ReadableStreamDefaultController>();

export function addClient(controller: ReadableStreamDefaultController) {
    clients.add(controller);
}

export function removeClient(controller: ReadableStreamDefaultController) {
    clients.delete(controller);
}

export function notifyClients() {
    const msg = `data: ${JSON.stringify({ type: "new-message" })}\n\n`;
    const encoder = new TextEncoder();
    for (const c of clients) {
        try {
            c.enqueue(encoder.encode(msg));
        } catch {
            clients.delete(c);
        }
    }
}

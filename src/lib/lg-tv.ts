import fs from "fs";
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LGTV = require("lgtv2");

// LG C2 and newer webOS TVs require WSS (TLS) on port 3001 with a self-signed cert.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

/** Resolve the directory where key files are stored (same dir as SQLite DB). */
function dataDir(): string {
    const dbPath = (process.env.DATABASE_URL || "file:./dev.db").replace(/^file:/, "");
    return path.dirname(path.resolve(dbPath));
}

function keyFilePath(ip: string): string {
    return path.join(dataDir(), `lgtv-key-${ip.replace(/[^0-9]/g, "_")}.json`);
}

function readKey(filePath: string): string | null {
    try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        return typeof data.clientKey === "string" ? data.clientKey : null;
    } catch {
        return null;
    }
}

/**
 * Initiate pairing with an LG webOS TV.
 * The TV will show an "Allow access?" prompt — the user must accept within 60 s.
 * Resolves with the client key on success.
 */
export async function pairLgTv(ip: string): Promise<string> {
    const keyFile = keyFilePath(ip);
    fs.mkdirSync(path.dirname(keyFile), { recursive: true });

    return new Promise((resolve, reject) => {
        let settled = false;

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            try { lgtv.disconnect(); } catch { /* ignore */ }
            reject(new Error("Pairing timed out (60 s) — did you accept on the TV?"));
        }, 60_000);

        // eslint-disable-next-line prefer-const
        let lgtv: ReturnType<typeof LGTV>;
        lgtv = LGTV({
            url: `wss://${ip}:3001`,
            // Always provide clientKeyFile so lgtv2's internal saveKey() has a path to write to.
            // Omit clientKey so lgtv2 treats this as a new pairing and always writes the file.
            clientKeyFile: keyFile,
            reconnect: false,
        });

        lgtv.on("connect", () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { lgtv.disconnect(); } catch { /* ignore */ }

            // lgtv2 exposes the key directly on the instance after connect.
            // Fall back to reading from file in case the instance property isn't set.
            const key =
                ((lgtv as Record<string, unknown>).clientKey as string | undefined) ||
                readKey(keyFile);

            if (key) {
                // Ensure the key is persisted to our file regardless of lgtv2's write logic.
                fs.writeFileSync(keyFile, JSON.stringify({ clientKey: key }));
                resolve(key);
            } else {
                reject(new Error("Paired but no client key returned by TV"));
            }
        });

        lgtv.on("error", (err: Error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(err);
        });
    });
}

/**
 * Send a toast notification overlay to an LG TV.
 * Returns true if the TV was reachable and the message was delivered.
 * Returns false if the TV is off, unreachable, or not yet paired.
 */
export async function sendLgTvToast(ip: string, message: string): Promise<boolean> {
    const keyFile = keyFilePath(ip);
    const clientKey = readKey(keyFile);

    if (!clientKey) {
        console.warn(`[LgTv] No client key for ${ip} — TV not paired`);
        return false;
    }

    return new Promise((resolve) => {
        let settled = false;

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            try { lgtv.disconnect(); } catch { /* ignore */ }
            resolve(false); // TV unreachable / off
        }, 5_000);

        // eslint-disable-next-line prefer-const
        let lgtv: ReturnType<typeof LGTV>;
        lgtv = LGTV({
            url: `wss://${ip}:3001`,
            clientKey,
            // Always provide clientKeyFile so lgtv2's saveKey() doesn't crash on undefined path.
            clientKeyFile: keyFile,
            reconnect: false,
        });

        lgtv.on("connect", () => {
            if (settled) return;
            // LG webOS createToast has a 60-character limit
            const truncated = message.length > 60 ? message.slice(0, 57) + "..." : message;
            lgtv.request(
                "ssap://system.notifications/createToast",
                { message: truncated },
                (err: Error | null) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    try { lgtv.disconnect(); } catch { /* ignore */ }
                    resolve(!err);
                }
            );
        });

        lgtv.on("error", () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(false); // TV off or unreachable
        });
    });
}

/** Returns true if this TV IP has a stored pairing key. */
export function isLgTvPaired(ip: string): boolean {
    return readKey(keyFilePath(ip)) !== null;
}

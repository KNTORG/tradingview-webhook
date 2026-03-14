/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client, DefaultMediaReceiver } from "castv2-client";
import { getAllAudioUrls } from "google-tts-api";
import { exec } from "child_process";

/**
 * Discover Google Home / Chromecast devices on the local network
 * using bonjour (mDNS/DNS-SD).
 */
export interface DiscoveredSpeaker {
    name: string;
    ip: string;
    port: number;
}

let bonjourInstance: any = null;

async function getBonjour() {
    if (!bonjourInstance) {
        const { Bonjour } = await import("bonjour-service");
        bonjourInstance = new Bonjour({ port: 5354 });
    }
    return bonjourInstance;
}

/**
 * Discover speakers via the system's Avahi daemon using avahi-browse.
 * Requires avahi-tools installed in the container AND the host D-Bus socket
 * mounted at /run/dbus/system_bus_socket (or DBUS_SYSTEM_BUS_ADDRESS set).
 * Returns null if avahi-browse is not available or fails.
 */
function discoverViaAvahi(timeoutMs: number): Promise<DiscoveredSpeaker[] | null> {
    return new Promise((resolve) => {
        let output = "";
        let finished = false;

        const finish = () => {
            if (finished) return;
            finished = true;

            const speakers: DiscoveredSpeaker[] = [];
            for (const line of output.split("\n")) {
                // avahi-browse -p resolved lines start with '='
                // format: =;iface;proto;name;type;domain;hostname;address;port;txt...
                if (!line.startsWith("=")) continue;
                const parts = line.split(";");
                if (parts.length < 9) continue;

                const ip = parts[7];
                const port = parseInt(parts[8]) || 8009;
                // avahi escapes spaces as \032
                const rawName = parts[3].replace(/\\032/g, " ");
                // prefer the friendly name from TXT record (fn=...)
                const txtPart = parts.slice(9).join(";");
                const fnMatch = txtPart.match(/"fn=([^"]+)"/);
                const name = fnMatch ? fnMatch[1] : rawName;

                if (ip && !speakers.find((s) => s.ip === ip)) {
                    speakers.push({ name, ip, port });
                }
            }
            resolve(speakers);
        };

        const child = exec("avahi-browse -r -p _googlecast._tcp 2>/dev/null");

        child.stdout?.on("data", (data: string) => { output += data; });

        // avahi-browse unavailable or daemon not reachable → reject so caller falls back
        child.on("error", () => resolve(null));
        child.on("close", (code: number | null) => {
            if (code !== 0 && output.trim() === "") {
                resolve(null); // not available
            } else {
                finish();
            }
        });

        // Kill after timeout and process whatever we have so far
        setTimeout(() => {
            child.kill("SIGTERM");
            finish();
        }, timeoutMs);
    });
}

export async function discoverSpeakers(
    timeoutMs = 3000,
    targetName?: string
): Promise<DiscoveredSpeaker[]> {
    // Primary: use avahi-browse to query the system Avahi daemon.
    // This works on TrueNAS Scale (host network) when the host D-Bus socket
    // is mounted into the container at /run/dbus/system_bus_socket.
    const avahiSpeakers = await discoverViaAvahi(timeoutMs);
    if (avahiSpeakers !== null) {
        // avahi-browse ran successfully (even if 0 results)
        return targetName
            ? avahiSpeakers.filter(
                  (s) => s.name.toLowerCase() === targetName.toLowerCase()
              )
            : avahiSpeakers;
    }

    // Fallback: direct mDNS via bonjour-service on port 5354.
    // Works when Avahi is not accessible; relies on devices sending unicast
    // responses (RFC 6762 §6) since we can't share port 5353 with Avahi.
    const bonjour = await getBonjour();
    const speakers: DiscoveredSpeaker[] = [];

    return new Promise((resolve) => {
        const browser = bonjour.find({ type: "googlecast" });
        let resolved = false;

        const finish = () => {
            if (resolved) return;
            resolved = true;
            browser.stop();
            resolve(speakers);
        };

        browser.on("up", (service: any) => {
            const name =
                service.txt?.fn || service.txt?.md || service.name || "Unknown";
            const ip =
                service.referer?.address ||
                (service.addresses && service.addresses[0]) ||
                "";
            if (ip) {
                const speaker = { name, ip, port: service.port || 8009 };
                speakers.push(speaker);
                if (targetName && name.toLowerCase() === targetName.toLowerCase()) {
                    finish();
                }
            }
        });

        setTimeout(finish, timeoutMs);
    });
}

/**
 * Find a speaker by name from discovered devices
 */
export async function findSpeakerByName(
    speakerName: string,
    fallbackIp?: string | null
): Promise<{ ip: string; port: number } | null> {
    // If we have a manual IP, use it directly
    if (fallbackIp) {
        return { ip: fallbackIp, port: 8009 };
    }

    // Otherwise discover via mDNS, with early exit
    const speakers = await discoverSpeakers(3000, speakerName);
    const match = speakers.find(
        (s) => s.name.toLowerCase() === speakerName.toLowerCase()
    );

    if (match) {
        return { ip: match.ip, port: match.port };
    }

    return null;
}

/**
 * Cast TTS audio to a Google Home speaker
 */
export async function castToSpeaker(
    speakerName: string,
    text: string,
    speakerIp?: string | null
): Promise<void> {
    const target = await findSpeakerByName(speakerName, speakerIp);

    if (!target) {
        throw new Error(
            `Speaker "${speakerName}" not found on network. Configure an IP manually.`
        );
    }

    // Generate TTS audio URLs (google-tts-api splits long text into chunks)
    const audioUrls = getAllAudioUrls(text, {
        lang: "en",
        slow: false,
    });

    // Cast each audio chunk to the speaker
    for (const audio of audioUrls) {
        await playSingleUrl(target.ip, target.port, audio.url);
    }
}

/**
 * Play a single audio URL on a Chromecast device
 */
function playSingleUrl(
    ip: string,
    port: number,
    url: string
): Promise<void> {
    return new Promise((resolve, reject) => {
        const client = new Client();
        const timeout = setTimeout(() => {
            client.close();
            reject(new Error("Cast timeout after 30s"));
        }, 30000);

        client.connect({ host: ip, port }, () => {
            client.launch(DefaultMediaReceiver, (err: any, player: any) => {
                if (err) {
                    clearTimeout(timeout);
                    client.close();
                    return reject(err);
                }

                const media = {
                    contentId: url,
                    contentType: "audio/mpeg",
                    streamType: "BUFFERED",
                };

                player.load(media, { autoplay: true }, (err: any) => {
                    if (err) {
                        clearTimeout(timeout);
                        client.close();
                        return reject(err);
                    }

                    // Wait for the media to finish playing
                    player.on("status", (status: any) => {
                        if (
                            status.idleReason === "FINISHED" ||
                            status.playerState === "IDLE"
                        ) {
                            clearTimeout(timeout);
                            client.close();
                            resolve();
                        }
                    });
                });
            });
        });

        client.on("error", (err: any) => {
            clearTimeout(timeout);
            client.close();
            reject(err);
        });
    });
}

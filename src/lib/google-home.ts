/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client, DefaultMediaReceiver } from "castv2-client";
import { getAllAudioUrls } from "google-tts-api";

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
        // Use reuseAddr so we don't crash if another process (like avahi) is using 5353 on host network
        // @ts-expect-error bonjour-service doesn't expose reuseAddr in TS types, but underlying dgram does
        bonjourInstance = new Bonjour({ reuseAddr: true });
    }
    return bonjourInstance;
}

export async function discoverSpeakers(
    timeoutMs = 3000,
    targetName?: string
): Promise<DiscoveredSpeaker[]> {
    const bonjour = await getBonjour();
    const speakers: DiscoveredSpeaker[] = [];

    return new Promise((resolve) => {
        const browser = bonjour.find({ type: "googlecast" });
        let resolved = false;

        const finish = () => {
            if (resolved) return;
            resolved = true;
            browser.stop();
            // Do not destroy bonjour instance as it's shared
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
                const speaker = {
                    name,
                    ip,
                    port: service.port || 8009,
                };
                speakers.push(speaker);

                // Early exit if we found our target
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

import { prisma } from "./prisma";
import { castToSpeaker } from "./google-home";
import { isSpeakerActive } from "./schedule";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 30000; // 30 seconds

export interface RetryJob {
    messageId: string;
    text: string;
    speakerName: string;
    speakerIp: string | null;
    attempts: number;
}

const queue: RetryJob[] = [];

export function addToRetryQueue(job: RetryJob) {
    queue.push(job);
    console.log(`[RetryQueue] Added job for "${job.speakerName}" (Message: ${job.messageId})`);
    
    // Start processing if not already
    setTimeout(() => processNext(job), RETRY_DELAY_MS);
}

async function processNext(job: RetryJob) {
    // 1. Check if speaker is still active according to schedule
    const active = await isSpeakerActive(job.speakerName);
    if (!active) {
        console.log(`[RetryQueue] Speaker "${job.speakerName}" no longer active by schedule. Dropping retry.`);
        return;
    }

    try {
        console.log(`[RetryQueue] Attempt ${job.attempts + 1}/${MAX_RETRIES} for "${job.speakerName}"`);
        await castToSpeaker(job.speakerName, job.text, job.speakerIp);
        
        // Success! Update DB
        const msg = await prisma.message.findUnique({ where: { id: job.messageId } });
        if (msg) {
            const currentSpeakers = JSON.parse(msg.speakers);
            if (!currentSpeakers.includes(job.speakerName)) {
                currentSpeakers.push(job.speakerName);
            }
            
            await prisma.message.update({
                where: { id: job.messageId },
                data: {
                    status: "spoken",
                    speakers: JSON.stringify(currentSpeakers),
                    error: null,
                }
            });
        }
    } catch (err) {
        job.attempts++;
        if (job.attempts < MAX_RETRIES) {
            console.error(`[RetryQueue] Attempt ${job.attempts} failed for "${job.speakerName}": ${err}. Retrying...`);
            setTimeout(() => processNext(job), RETRY_DELAY_MS);
        } else {
            console.error(`[RetryQueue] Max retries reached for "${job.speakerName}".`);
            await prisma.message.update({
                where: { id: job.messageId },
                data: {
                    error: `Failed after ${MAX_RETRIES} retries: ${err instanceof Error ? err.message : "Unknown error"}`
                }
            });
        }
    }
}

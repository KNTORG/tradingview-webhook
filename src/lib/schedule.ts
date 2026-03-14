import { prisma } from "./prisma";

export const TIMEZONE = process.env.TZ || "Asia/Bangkok";

/**
 * Get the current time in the configured timezone
 */
function getNowInTimezone(): { dayOfWeek: number; timeString: string } {
    const now = new Date();
    const tz = process.env.TZ || "Asia/Bangkok";
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const weekdayStr = parts.find((p) => p.type === "weekday")?.value || "";
    const hour = parts.find((p) => p.type === "hour")?.value || "00";
    const minute = parts.find((p) => p.type === "minute")?.value || "00";

    const dayMap: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
    };

    return {
        dayOfWeek: dayMap[weekdayStr] ?? 0,
        timeString: `${hour}:${minute}`,
    };
}

/**
 * Check if a time string (HH:mm) is within a range
 */
export function isTimeInRange(
    current: string,
    start: string,
    end: string
): boolean {
    // Handle overnight ranges (e.g., 22:00 - 06:00)
    if (start <= end) {
        return current >= start && current < end;
    } else {
        // Overnight: current >= start OR current < end
        return current >= start || current < end;
    }
}

export interface ActiveSpeaker {
    speakerName: string;
    speakerIp: string | null;
}

/**
 * Check if two time ranges (HH:mm) overlap.
 */
export function rangesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
): boolean {
    // A range [S, E) overlaps with [S2, E2) if there's some T such that
    // S <= T < E  AND  S2 <= T < E2
    
    // We can check this by testing if one range starts before the other ends
    // but we must handle overnight ranges.
    
    // Convert to minute-of-day for easier math
    const toMin = (t: string) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
    };

    const s1 = toMin(start1);
    const e1 = toMin(end1);
    const s2 = toMin(start2);
    const e2 = toMin(end2);

    // Normalize ranges to sets of intervals
    const getIntervals = (s: number, e: number) => {
        if (s === e) return [[0, 1440]]; // 24h range
        if (s < e) return [[s, e]];      // Normal: 08:00 - 22:00
        return [[s, 1440], [0, e]];      // Overnight: 22:00 - 02:00
    };

    const intervals1 = getIntervals(s1, e1);
    const intervals2 = getIntervals(s2, e2);

    for (const [is1, ie1] of intervals1) {
        for (const [is2, ie2] of intervals2) {
            // Standard overlap for [is1, ie1) and [is2, ie2)
            if (is1 < ie2 && is2 < ie1) return true;
        }
    }

    return false;
}

/**
 * Get all speakers that are currently active based on their schedules.
 * A speaker is active if it has at least one enabled schedule rule
 * matching the current day of week and time (in Asia/Bangkok timezone).
 * A global schedule (dayOfWeek = -1) overrides daily schedules.
 */
export async function getActiveSpeakers(): Promise<ActiveSpeaker[]> {
    const { dayOfWeek, timeString } = getNowInTimezone();

    const matchingSchedules = await prisma.speakerSchedule.findMany({
        where: {
            enabled: true,
            dayOfWeek: { in: [dayOfWeek, -1] }
        },
    });

    // Group by speaker
    const bySpeaker = new Map<string, typeof matchingSchedules>();
    for (const s of matchingSchedules) {
        if (!bySpeaker.has(s.speakerName)) bySpeaker.set(s.speakerName, []);
        bySpeaker.get(s.speakerName)!.push(s);
    }

    const activeSpeakers = new Map<string, ActiveSpeaker>();

    for (const [speakerName, schedules] of bySpeaker.entries()) {
        const globalSchedule = schedules.find(s => s.dayOfWeek === -1);
        const todaySchedules = schedules.filter(s => s.dayOfWeek === dayOfWeek);

        let isActive = false;
        let activeIp = schedules[0].speakerIp;

        if (globalSchedule) {
            // Global schedule overrides daily schedules
            isActive = isTimeInRange(timeString, globalSchedule.startTime, globalSchedule.endTime);
            if (isActive) activeIp = globalSchedule.speakerIp || activeIp;
        } else {
            // Use daily schedules
            for (const schedule of todaySchedules) {
                if (isTimeInRange(timeString, schedule.startTime, schedule.endTime)) {
                    isActive = true;
                    activeIp = schedule.speakerIp || activeIp;
                    break;
                }
            }
        }

        if (isActive) {
            activeSpeakers.set(speakerName, { speakerName, speakerIp: activeIp });
        }
    }

    return Array.from(activeSpeakers.values());
}

/**
 * Check if a specific speaker is currently active
 */
export async function isSpeakerActive(
    speakerName: string
): Promise<boolean> {
    const activeSpeakers = await getActiveSpeakers();
    return activeSpeakers.some((s) => s.speakerName === speakerName);
}

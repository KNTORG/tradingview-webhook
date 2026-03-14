export interface ScheduleRule {
    id: string;
    speakerName: string;
    speakerIp: string | null;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    enabled: boolean;
}

export interface SpeakerGroup {
    speakerName: string;
    speakerIp: string | null;
    rules: ScheduleRule[];
}

export interface DiscoveredSpeaker {
    name: string;
    ip: string;
    port: number;
}

export interface PurgeStats {
    totalMessages: number;
    dbSizeBytes: number;
    dbSizeFormatted: string;
    oldestMessageDate: string | null;
}

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const FULL_DAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

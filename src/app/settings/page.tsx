"use client";

import { useState, useEffect, useCallback } from "react";

interface ScheduleRule {
    id: string;
    speakerName: string;
    speakerIp: string | null;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    enabled: boolean;
}

interface SpeakerGroup {
    speakerName: string;
    speakerIp: string | null;
    rules: ScheduleRule[];
}

interface DiscoveredSpeaker {
    name: string;
    ip: string;
    port: number;
}

interface PurgeStats {
    totalMessages: number;
    dbSizeBytes: number;
    dbSizeFormatted: string;
    oldestMessageDate: string | null;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

export default function SettingsPage() {
    const [speakers, setSpeakers] = useState<SpeakerGroup[]>([]);
    const [discovered, setDiscovered] = useState<DiscoveredSpeaker[]>([]);
    const [discovering, setDiscovering] = useState(false);
    const [loading, setLoading] = useState(true);
    const [testing, setTesting] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<{
        speaker: string;
        success: boolean;
        message: string;
    } | null>(null);
    const [customMessages, setCustomMessages] = useState<Record<string, string>>({});

    // Purge state
    const [purgeStats, setPurgeStats] = useState<PurgeStats | null>(null);
    const [purgeDays, setPurgeDays] = useState(30);
    const [purging, setPurging] = useState(false);
    const [purgeConfirm, setPurgeConfirm] = useState(false);
    const [purgeResult, setPurgeResult] = useState<string | null>(null);

    // Confirmation modal state
    const [confirmAction, setConfirmAction] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
    } | null>(null);

    // Webhook Secret State
    const [webhookSecret, setWebhookSecret] = useState("");
    const [publicUrl, setPublicUrl] = useState("");
    const [savingSecret, setSavingSecret] = useState(false);
    const [secretSaved, setSecretSaved] = useState(false);

    const generateSecret = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        const newSecret = Array.from({ length: 16 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join("");
        setWebhookSecret(newSecret);
    };

    // Add/Edit schedule modal state
    const [scheduleModal, setScheduleModal] = useState<{
        mode: "add" | "edit";
        ruleId?: string;
        speakerName: string;
        speakerIp?: string;
    } | null>(null);
    const [ruleForm, setRuleForm] = useState({
        dayOfWeek: 1,
        startTime: "08:00",
        endTime: "22:00",
    });

    // Add speaker modal
    const [showAddSpeaker, setShowAddSpeaker] = useState(false);
    const [newSpeakerName, setNewSpeakerName] = useState("");
    const [newSpeakerIp, setNewSpeakerIp] = useState("");

    const fetchSchedules = useCallback(async () => {
        try {
            const res = await fetch("/api/schedules");
            const data = await res.json();
            setSpeakers(data.speakers);
        } catch (err) {
            console.error("Failed to fetch schedules:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchPurgeStats = useCallback(async () => {
        try {
            const res = await fetch("/api/messages/purge");
            const data = await res.json();
            setPurgeStats(data);
        } catch (err) {
            console.error("Failed to fetch purge stats:", err);
        }
    }, []);

    const fetchWebhookSecret = useCallback(async () => {
        try {
            const res = await fetch("/api/settings/webook");
            if (res.ok) {
                const data = await res.json();
                setWebhookSecret(data.secret || "");
                setPublicUrl(data.publicUrl || "");
            }
        } catch (err) {
            console.error("Failed to fetch settings:", err);
        }
    }, []);

    useEffect(() => {
        fetchSchedules();
        fetchPurgeStats();
        fetchWebhookSecret();
    }, [fetchSchedules, fetchPurgeStats, fetchWebhookSecret]);

    const saveWebhookSecret = async () => {
        setSavingSecret(true);
        try {
            await fetch("/api/settings/webook", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    secret: webhookSecret,
                    publicUrl: publicUrl
                }),
            });
            setSecretSaved(true);
            setTimeout(() => setSecretSaved(false), 2000);
        } catch (err) {
            console.error("Failed to save settings:", err);
        } finally {
            setSavingSecret(false);
        }
    };

    const discoverSpeakers = async () => {
        setDiscovering(true);
        try {
            const res = await fetch("/api/speakers");
            const data = await res.json();
            setDiscovered(data.speakers || []);
        } catch (err) {
            console.error("Discovery failed:", err);
        } finally {
            setDiscovering(false);
        }
    };

    const testSpeaker = async (speakerName: string, speakerIp?: string | null) => {
        setTesting(speakerName);
        setTestResult(null);

        const text = customMessages[speakerName] || "This is a test message from Trade Alert Speaker.";

        try {
            const res = await fetch("/api/test-speak", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ speakerName, speakerIp, text }),
            });
            const data = await res.json();
            setTestResult({
                speaker: speakerName,
                success: data.success,
                message: data.success
                    ? "Test message sent!"
                    : data.error || "Failed",
            });
        } catch (err) {
            setTestResult({
                speaker: speakerName,
                success: false,
                message: err instanceof Error ? err.message : "Failed",
            });
        } finally {
            setTesting(null);
        }
    };

    const toggleRule = async (rule: ScheduleRule) => {
        try {
            await fetch(`/api/schedules/${rule.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled: !rule.enabled }),
            });
            fetchSchedules();
        } catch (err) {
            console.error("Failed to toggle rule:", err);
        }
    };

    const deleteRule = async (ruleId: string) => {
        setConfirmAction({
            title: "Delete Time Schedule",
            message: "Are you sure you want to delete this time schedule?",
            onConfirm: async () => {
                try {
                    await fetch(`/api/schedules/${ruleId}`, { method: "DELETE" });
                    fetchSchedules();
                    setConfirmAction(null);
                } catch (err) {
                    console.error("Failed to delete rule:", err);
                }
            }
        });
    };

    const deleteSpeaker = async (speaker: SpeakerGroup) => {
        setConfirmAction({
            title: "Remove Speaker",
            message: `Are you sure you want to completely remove "${speaker.speakerName}" and all its schedules?`,
            onConfirm: async () => {
                try {
                    await Promise.all(speaker.rules.map(r => fetch(`/api/schedules/${r.id}`, { method: "DELETE" })));
                    fetchSchedules();
                    setConfirmAction(null);
                } catch (err) {
                    console.error("Failed to delete speaker:", err);
                }
            }
        });
    };

    const saveRule = async () => {
        if (!scheduleModal) return;
        try {
            let res: Response;
            if (scheduleModal.mode === "add") {
                res = await fetch("/api/schedules", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        speakerName: scheduleModal.speakerName,
                        speakerIp: scheduleModal.speakerIp || undefined,
                        ...ruleForm,
                    }),
                });
            } else {
                res = await fetch(`/api/schedules/${scheduleModal.ruleId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(ruleForm),
                });
            }

            if (!res.ok) {
                const data = await res.json();
                alert(data.error || "Failed to save schedule");
                return;
            }

            setScheduleModal(null);
            setRuleForm({ dayOfWeek: 1, startTime: "08:00", endTime: "22:00" });
            fetchSchedules();
        } catch (err) {
            console.error("Failed to save rule:", err);
            alert("An unexpected error occurred");
        }
    };

    const addSpeakerWithDefaults = async () => {
        if (!newSpeakerName.trim()) return;
        // Create default rules for all 7 days
        try {
            for (let day = 0; day < 7; day++) {
                await fetch("/api/schedules", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        speakerName: newSpeakerName.trim(),
                        speakerIp: newSpeakerIp.trim() || undefined,
                        dayOfWeek: day,
                        startTime: "08:00",
                        endTime: "22:00",
                    }),
                });
            }
            setShowAddSpeaker(false);
            setNewSpeakerName("");
            setNewSpeakerIp("");
            fetchSchedules();
        } catch (err) {
            console.error("Failed to add speaker:", err);
        }
    };

    const purgeMessages = async () => {
        setPurging(true);
        setPurgeResult(null);
        try {
            const res = await fetch(
                `/api/messages/purge?olderThanDays=${purgeDays}`,
                { method: "DELETE" }
            );
            const data = await res.json();
            setPurgeResult(
                `Deleted ${data.deleted} messages. DB size: ${data.dbSizeFormatted}. Remaining: ${data.remaining} messages.`
            );
            setPurgeConfirm(false);
            fetchPurgeStats();
        } catch (err) {
            setPurgeResult(
                `Error: ${err instanceof Error ? err.message : "Unknown error"}`
            );
        } finally {
            setPurging(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="flex items-center gap-3 text-gray-400">
                    <div className="w-5 h-5 border-2 border-coral-300 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Loading settings...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Configure speaker schedules and manage your database
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={discoverSpeakers}
                        disabled={discovering}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-warm-200 text-gray-600 hover:bg-warm-100 disabled:opacity-50 transition-all"
                    >
                        {discovering ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                                Scanning...
                            </span>
                        ) : (
                            "🔍 Discover Speakers"
                        )}
                    </button>
                    <button
                        onClick={() => setShowAddSpeaker(true)}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-coral-400 to-coral-500 text-white hover:from-coral-500 hover:to-coral-600 shadow-sm hover:shadow-md transition-all"
                    >
                        + Add Speaker
                    </button>
                </div>
            </div>

            {/* Discovered speakers */}
            {discovered.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                    <h3 className="text-sm font-semibold text-blue-800 mb-2">
                        🔊 Discovered Speakers on Network
                    </h3>
                    <div className="space-y-2">
                        {discovered.map((s) => (
                            <div
                                key={s.ip}
                                className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-blue-100"
                            >
                                <div>
                                    <span className="font-medium text-sm text-gray-900">
                                        {s.name}
                                    </span>
                                    <span className="text-xs text-gray-400 ml-2">
                                        {s.ip}:{s.port}
                                    </span>
                                </div>
                                <button
                                    onClick={() => {
                                        setNewSpeakerName(s.name);
                                        setNewSpeakerIp(s.ip);
                                        setShowAddSpeaker(true);
                                    }}
                                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                                >
                                    Add →
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Speaker Cards */}
            {speakers.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-12 text-center">
                    <div className="text-4xl mb-3">🔇</div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                        No speakers configured
                    </h3>
                    <p className="text-sm text-gray-500">
                        Click &quot;Add Speaker&quot; or &quot;Discover Speakers&quot; to get started.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {speakers.map((speaker) => (
                        <div
                            key={speaker.speakerName}
                            className="bg-white rounded-2xl shadow-sm border border-warm-200 overflow-hidden"
                        >
                            {/* Speaker Header */}
                            <div className="px-5 py-4 border-b border-warm-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-coral-100 to-coral-200 flex items-center justify-center shrink-0">
                                        <span className="text-lg">🔊</span>
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-semibold text-gray-900 truncate">
                                            {speaker.speakerName}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            {speaker.speakerIp && (
                                                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md border truncate">
                                                    IP: {speaker.speakerIp}
                                                </span>
                                            )}
                                            <button
                                                onClick={() => deleteSpeaker(speaker)}
                                                className="text-xs font-semibold text-red-500 hover:bg-red-50 px-2 py-0.5 rounded-md transition-colors whitespace-nowrap"
                                            >
                                                🗑️ Remove Speaker
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex w-full md:w-auto md:min-w-[300px]">
                                    <div className="flex gap-2 w-full">
                                        <input
                                            type="text"
                                            placeholder="Enter test message..."
                                            value={customMessages[speaker.speakerName] || ""}
                                            onChange={(e) => setCustomMessages({ ...customMessages, [speaker.speakerName]: e.target.value })}
                                            className="flex-1 px-3 py-1.5 rounded-xl border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-coral-300 min-w-0"
                                        />
                                        <button
                                            onClick={() =>
                                                testSpeaker(speaker.speakerName, speaker.speakerIp)
                                            }
                                            disabled={testing === speaker.speakerName}
                                            className="px-5 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-coral-400 to-coral-500 text-white hover:from-coral-500 hover:to-coral-600 shadow-sm disabled:opacity-50 transition-all whitespace-nowrap shrink-0 flex items-center gap-2"
                                        >
                                            {testing === speaker.speakerName
                                                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                : "🔊 Speak"}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Test result */}
                            {testResult && testResult.speaker === speaker.speakerName && (
                                <div
                                    className={`px-5 py-2.5 text-xs font-medium ${testResult.success
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-red-50 text-red-700"
                                        }`}
                                >
                                    {testResult.success ? "✓" : "✕"} {testResult.message}
                                </div>
                            )}

                            {/* Global Time Overlay */}
                            {(() => {
                                const globalRule = speaker.rules.find((r) => r.dayOfWeek === -1);
                                return (
                                    <div className="px-5 py-3 bg-indigo-50/50 border-b border-warm-200">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div>
                                                <h4 className="text-sm font-semibold text-indigo-900 flex items-center gap-1.5">
                                                    <span>🌍</span> Global Time Overlay
                                                </h4>
                                                <p className="text-xs text-indigo-700/70 mt-0.5">
                                                    When enabled, applies every day and overrides daily schedules
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-end gap-3">
                                                {globalRule ? (
                                                    <>
                                                        <span className={`text-sm font-medium ${globalRule.enabled ? 'text-indigo-800' : 'text-gray-400 line-through'}`}>
                                                            {globalRule.startTime} – {globalRule.endTime}
                                                        </span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setScheduleModal({
                                                                    mode: "edit",
                                                                    ruleId: globalRule.id,
                                                                    speakerName: speaker.speakerName,
                                                                    speakerIp: speaker.speakerIp || undefined
                                                                });
                                                                setRuleForm({
                                                                    dayOfWeek: -1,
                                                                    startTime: globalRule.startTime,
                                                                    endTime: globalRule.endTime
                                                                });
                                                            }}
                                                            title="Edit Global Time"
                                                            className="text-indigo-400 hover:text-indigo-600 transition-colors p-1"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                deleteRule(globalRule.id);
                                                            }}
                                                            title="Delete Global Time"
                                                            className="text-indigo-400 hover:text-red-500 transition-colors p-1 mr-1"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => toggleRule(globalRule)}
                                                            className={`relative w-8 h-4.5 rounded-full transition-colors ${globalRule.enabled
                                                                ? "bg-indigo-500"
                                                                : "bg-gray-300"
                                                                }`}
                                                        >
                                                            <span
                                                                className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform ${globalRule.enabled
                                                                    ? "translate-x-4"
                                                                    : "translate-x-0.5"
                                                                    }`}
                                                            />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setScheduleModal({
                                                                mode: "add",
                                                                speakerName: speaker.speakerName,
                                                                speakerIp: speaker.speakerIp || undefined,
                                                            });
                                                            setRuleForm({ dayOfWeek: -1, startTime: "08:00", endTime: "22:00" });
                                                        }}
                                                        className="text-xs px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-semibold transition-colors"
                                                    >
                                                        + Setup Global Time
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Schedule Rules */}
                            <div className="divide-y divide-warm-100">
                                {DAYS.map((day, dayIndex) => {
                                    const dayRules = speaker.rules.filter(
                                        (r) => r.dayOfWeek === dayIndex
                                    );
                                    return (
                                        <div key={dayIndex} className="px-5 py-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-gray-600 w-12">
                                                    {day}
                                                </span>
                                                <div className="flex-1 flex items-center gap-2 flex-wrap">
                                                    {dayRules.length === 0 ? (
                                                        <span className="text-xs text-gray-300 italic">
                                                            No schedule
                                                        </span>
                                                    ) : (
                                                        dayRules.map((rule) => (
                                                            <div
                                                                key={rule.id}
                                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${rule.enabled
                                                                    ? "bg-coral-50 border-coral-200 text-coral-700"
                                                                    : "bg-gray-50 border-gray-200 text-gray-400"
                                                                    }`}
                                                            >
                                                                <span>
                                                                    {rule.startTime} – {rule.endTime}
                                                                </span>
                                                                <button
                                                                    onClick={() => toggleRule(rule)}
                                                                    className={`relative w-8 h-4.5 rounded-full transition-colors ${rule.enabled
                                                                        ? "bg-coral-400"
                                                                        : "bg-gray-300"
                                                                        }`}
                                                                >
                                                                    <span
                                                                        className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform ${rule.enabled
                                                                            ? "translate-x-4"
                                                                            : "translate-x-0.5"
                                                                            }`}
                                                                    />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setScheduleModal({
                                                                            mode: "edit",
                                                                            ruleId: rule.id,
                                                                            speakerName: speaker.speakerName,
                                                                            speakerIp: speaker.speakerIp || undefined
                                                                        });
                                                                        setRuleForm({
                                                                            dayOfWeek: rule.dayOfWeek,
                                                                            startTime: rule.startTime,
                                                                            endTime: rule.endTime
                                                                        });
                                                                    }}
                                                                    title="Edit Schedule"
                                                                    className="text-gray-400 hover:text-blue-500 transition-colors ml-1 p-1"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        deleteRule(rule.id);
                                                                    }}
                                                                    title="Delete Schedule"
                                                                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setScheduleModal({
                                                            mode: "add",
                                                            speakerName: speaker.speakerName,
                                                            speakerIp: speaker.speakerIp || undefined,
                                                        });
                                                        setRuleForm({ dayOfWeek: dayIndex, startTime: "08:00", endTime: "22:00" });
                                                    }}
                                                    className="text-xs px-3 py-1.5 rounded-lg bg-warm-50 text-coral-600 hover:bg-coral-50 hover:text-coral-700 font-semibold ml-2 whitespace-nowrap transition-colors border border-warm-100 border-b-2"
                                                >
                                                    + Add Time
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Database Maintenance Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-warm-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-warm-200">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                            <span className="text-base">🗄️</span>
                        </div>
                        <h2 className="font-semibold text-gray-900">
                            Database Maintenance
                        </h2>
                    </div>
                </div>

                <div className="p-5">
                    {/* Stats */}
                    {purgeStats && (
                        <div className="grid grid-cols-3 gap-4 mb-5">
                            <div className="bg-warm-50 rounded-xl p-4 text-center">
                                <div className="text-2xl font-bold text-gray-900">
                                    {purgeStats.totalMessages.toLocaleString()}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    Total Messages
                                </div>
                            </div>
                            <div className="bg-warm-50 rounded-xl p-4 text-center">
                                <div className="text-2xl font-bold text-gray-900">
                                    {purgeStats.dbSizeFormatted}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    Database Size
                                </div>
                            </div>
                            <div className="bg-warm-50 rounded-xl p-4 text-center">
                                <div className="text-2xl font-bold text-gray-900">
                                    {purgeStats.oldestMessageDate
                                        ? new Date(
                                            purgeStats.oldestMessageDate
                                        ).toLocaleDateString("en-US", {
                                            timeZone: "Asia/Bangkok",
                                        })
                                        : "—"}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                    Oldest Message
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Purge Controls */}
                    <div className="flex items-end gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Delete messages older than
                            </label>
                            <select
                                value={purgeDays}
                                onChange={(e) => setPurgeDays(Number(e.target.value))}
                                className="w-full px-4 py-2.5 rounded-xl border border-warm-200 bg-warm-50 text-sm focus:outline-none focus:ring-2 focus:ring-coral-300 focus:border-transparent"
                            >
                                <option value={0}>All messages</option>
                                <option value={7}>7 days</option>
                                <option value={14}>14 days</option>
                                <option value={30}>30 days</option>
                                <option value={60}>60 days</option>
                                <option value={90}>90 days</option>
                                <option value={180}>180 days</option>
                                <option value={365}>1 year</option>
                            </select>
                        </div>
                        {!purgeConfirm ? (
                            <button
                                onClick={() => setPurgeConfirm(true)}
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-all"
                            >
                                🗑 Purge Old Messages
                            </button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={purgeMessages}
                                    disabled={purging}
                                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-all"
                                >
                                    {purging ? "Purging..." : "⚠ Confirm Delete"}
                                </button>
                                <button
                                    onClick={() => setPurgeConfirm(false)}
                                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-warm-100 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Purge result */}
                    {purgeResult && (
                        <div className="mt-3 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
                            {purgeResult}
                        </div>
                    )}
                </div>
            </div>

            {/* Application Settings Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-warm-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-warm-200">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <span className="text-base">⚙️</span>
                        </div>
                        <h2 className="font-semibold text-gray-900">
                            System Settings
                        </h2>
                    </div>
                </div>

                <div className="p-5 space-y-6">
                    <div className="max-w-2xl">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Public URL / Domain Configuration
                        </label>
                        <p className="text-xs text-gray-500 mb-3">
                            Set your DDNS domain or public IP (e.g., <code>https://yourhome.asuscomm.com:12345</code>). This is used to display the correct webhook URL on the dashboard.
                        </p>
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={publicUrl}
                                onChange={(e) => setPublicUrl(e.target.value)}
                                placeholder="e.g. https://yourname.asuscomm.com:12345"
                                className="w-full px-4 py-2.5 rounded-xl border border-warm-200 bg-warm-50 text-sm focus:outline-none focus:ring-2 focus:ring-coral-300 focus:border-transparent font-mono"
                            />
                        </div>
                    </div>

                    <div className="max-w-2xl">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Webhook Secret Configuration
                        </label>
                        <p className="text-xs text-gray-500 mb-3">
                            Customize the secret path used in your TradingView webhook URL (e.g., set to <code>my-secret-key</code> for <code>/api/webhook/my-secret-key</code>).
                        </p>
                        <div className="flex items-center gap-3">
                            <div className="flex-1 relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">
                                    /api/webhook/
                                </span>
                                <input
                                    type="text"
                                    value={webhookSecret}
                                    onChange={(e) => setWebhookSecret(e.target.value)}
                                    placeholder="Enter secure path..."
                                    className="w-full pl-28 pr-4 py-2.5 rounded-xl border border-warm-200 bg-warm-50 text-sm focus:outline-none focus:ring-2 focus:ring-coral-300 focus:border-transparent font-mono"
                                />
                            </div>
                            <button
                                onClick={generateSecret}
                                className="px-3 py-2.5 rounded-xl text-xs font-semibold border border-warm-200 text-gray-600 hover:bg-warm-100 transition-all"
                                title="Generate random secret"
                            >
                                ⚡ Generate
                            </button>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-warm-100 flex justify-end">
                        <button
                            onClick={saveWebhookSecret}
                            disabled={savingSecret || !webhookSecret.trim()}
                            className="px-8 py-2.5 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 transition-all shadow-sm"
                        >
                            {savingSecret ? "Saving..." : secretSaved ? "✓ Settings Saved!" : "Save All Settings"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Custom Confirmation Modal */}
            {confirmAction && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4 mx-auto">
                                <span className="text-2xl">⚠️</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
                                {confirmAction.title}
                            </h3>
                            <p className="text-sm text-gray-500 text-center mb-6">
                                {confirmAction.message}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmAction(null)}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmAction.onConfirm}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 shadow-sm transition-colors"
                                >
                                    Confirm Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Schedule Rule Modal */}
            {scheduleModal && (
                <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">
                            {scheduleModal.mode === "add" ? "Add Time Schedule" : "Edit Time Schedule"}
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">
                            For:{" "}
                            <span className="font-medium text-gray-900">
                                {scheduleModal.speakerName}
                            </span>
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Day of Week
                                </label>
                                <select
                                    value={ruleForm.dayOfWeek}
                                    onChange={(e) =>
                                        setRuleForm((r) => ({
                                            ...r,
                                            dayOfWeek: Number(e.target.value),
                                        }))
                                    }
                                    className="w-full px-4 py-2.5 rounded-xl border border-warm-200 bg-warm-50 text-sm focus:outline-none focus:ring-2 focus:ring-coral-300"
                                >
                                    <option value={-1}>🌍 Global Overlay</option>
                                    {FULL_DAYS.map((day, i) => (
                                        <option key={i} value={i}>
                                            {day}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Start Time
                                    </label>
                                    <input
                                        type="time"
                                        value={ruleForm.startTime}
                                        onChange={(e) =>
                                            setRuleForm((r) => ({
                                                ...r,
                                                startTime: e.target.value,
                                            }))
                                        }
                                        className="w-full px-4 py-2.5 rounded-xl border border-warm-200 bg-warm-50 text-sm focus:outline-none focus:ring-2 focus:ring-coral-300"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        End Time
                                    </label>
                                    <input
                                        type="time"
                                        value={ruleForm.endTime}
                                        onChange={(e) =>
                                            setRuleForm((r) => ({
                                                ...r,
                                                endTime: e.target.value,
                                            }))
                                        }
                                        className="w-full px-4 py-2.5 rounded-xl border border-warm-200 bg-warm-50 text-sm focus:outline-none focus:ring-2 focus:ring-coral-300"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 mt-6">
                            <button
                                onClick={saveRule}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-coral-400 to-coral-500 text-white hover:from-coral-500 hover:to-coral-600 shadow-sm transition-all"
                            >
                                {scheduleModal.mode === "add" ? "Save New Schedule" : "Update Schedule"}
                            </button>
                            <button
                                onClick={() => setScheduleModal(null)}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-warm-100 transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Speaker Modal */}
            {showAddSpeaker && (
                <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">
                            Add Speaker
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Add a Google Home speaker with default schedules (Mon-Sun,
                            8:00 AM – 10:00 PM).
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Speaker Name
                                </label>
                                <input
                                    type="text"
                                    value={newSpeakerName}
                                    onChange={(e) => setNewSpeakerName(e.target.value)}
                                    placeholder="e.g. Family Room speaker"
                                    className="w-full px-4 py-2.5 rounded-xl border border-warm-200 bg-warm-50 text-sm focus:outline-none focus:ring-2 focus:ring-coral-300"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    IP Address{" "}
                                    <span className="text-gray-400 font-normal">
                                        (optional, for manual connection)
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    value={newSpeakerIp}
                                    onChange={(e) => setNewSpeakerIp(e.target.value)}
                                    placeholder="e.g. 192.168.1.100"
                                    className="w-full px-4 py-2.5 rounded-xl border border-warm-200 bg-warm-50 text-sm focus:outline-none focus:ring-2 focus:ring-coral-300"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 mt-6">
                            <button
                                onClick={addSpeakerWithDefaults}
                                disabled={!newSpeakerName.trim()}
                                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-coral-400 to-coral-500 text-white hover:from-coral-500 hover:to-coral-600 shadow-sm disabled:opacity-50 transition-all"
                            >
                                Add Speaker
                            </button>
                            <button
                                onClick={() => {
                                    setShowAddSpeaker(false);
                                    setNewSpeakerName("");
                                    setNewSpeakerIp("");
                                }}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-warm-100 transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

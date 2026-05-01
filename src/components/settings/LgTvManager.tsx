"use client";

import { useState, useEffect } from "react";
import { ScheduleRule, SpeakerGroup, DAYS, FULL_DAYS } from "@/types/settings";

interface LgTvManagerProps {
    onRefresh?: () => void;
}

export default function LgTvManager({ onRefresh }: LgTvManagerProps) {
    const [tvs, setTvs] = useState<SpeakerGroup[]>([]);
    const [loading, setLoading] = useState(true);

    // Add TV modal
    const [showAddTv, setShowAddTv] = useState(false);
    const [newName, setNewName] = useState("");
    const [newIp, setNewIp] = useState("");
    const [pairing, setPairing] = useState(false);
    const [pairStatus, setPairStatus] = useState<{ success: boolean; message: string } | null>(null);

    // Test notification
    const [testing, setTesting] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<{ tv: string; success: boolean; message: string } | null>(null);
    const [customMessages, setCustomMessages] = useState<Record<string, string>>({});

    // Confirm delete
    const [confirmAction, setConfirmAction] = useState<{
        title: string;
        message: string;
        onConfirm: () => void;
    } | null>(null);

    // Schedule modal
    const [scheduleModal, setScheduleModal] = useState<{
        mode: "add" | "edit";
        ruleId?: string;
        speakerName: string;
        speakerIp?: string;
    } | null>(null);
    const [ruleForm, setRuleForm] = useState({ dayOfWeek: 0, startTime: "08:00", endTime: "22:00" });

    const fetchTvs = async () => {
        try {
            const res = await fetch("/api/schedules?channelType=lgtv");
            const data = await res.json();
            setTvs(data.speakers || []);
        } catch (err) {
            console.error("Failed to fetch LG TVs:", err);
        } finally {
            setLoading(false);
        }
    };

    const pairTv = async () => {
        if (!newName.trim() || !newIp.trim()) return;
        setPairing(true);
        setPairStatus(null);
        try {
            const res = await fetch("/api/lgtv/pair", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName.trim(), ip: newIp.trim() }),
            });
            const data = await res.json();
            if (res.ok) {
                setPairStatus({ success: true, message: `Paired successfully! Schedules created for "${newName.trim()}"` });
                await fetchTvs();
                onRefresh?.();
            } else {
                setPairStatus({ success: false, message: data.error || "Pairing failed" });
            }
        } catch {
            setPairStatus({ success: false, message: "Network error during pairing" });
        } finally {
            setPairing(false);
        }
    };

    const repairTv = async (name: string, ip: string) => {
        setPairing(true);
        setPairStatus(null);
        try {
            const res = await fetch("/api/lgtv/pair", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, ip }),
            });
            const data = await res.json();
            if (res.ok) {
                setPairStatus({ success: true, message: "Re-paired successfully!" });
                await fetchTvs();
            } else {
                setPairStatus({ success: false, message: data.error || "Pairing failed" });
            }
        } catch {
            setPairStatus({ success: false, message: "Network error during pairing" });
        } finally {
            setPairing(false);
        }
    };

    const testTv = async (speakerName: string, ip: string) => {
        setTesting(speakerName);
        setTestResult(null);
        try {
            const message = customMessages[speakerName] || "Trade Alert: This is a test notification from Trade Alert Speaker.";
            const res = await fetch("/api/lgtv/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ip, message }),
            });
            const data = await res.json();
            setTestResult({
                tv: speakerName,
                success: res.ok,
                message: data.error || (res.ok ? "Notification sent" : "Failed"),
            });
        } catch {
            setTestResult({ tv: speakerName, success: false, message: "Network error" });
        } finally {
            setTesting(null);
        }
    };

    const toggleRule = async (rule: ScheduleRule) => {
        await fetch(`/api/schedules/${rule.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled: !rule.enabled }),
        });
        fetchTvs();
    };

    const deleteRule = (ruleId: string) => {
        setConfirmAction({
            title: "Delete Time Schedule",
            message: "Are you sure you want to delete this schedule rule?",
            onConfirm: async () => {
                await fetch(`/api/schedules/${ruleId}`, { method: "DELETE" });
                await fetchTvs();
                setConfirmAction(null);
            },
        });
    };

    const deleteTv = (tv: SpeakerGroup) => {
        setConfirmAction({
            title: "Remove LG TV",
            message: `Are you sure you want to remove "${tv.speakerName}" and all its schedule rules?`,
            onConfirm: async () => {
                await Promise.all(tv.rules.map((r) => fetch(`/api/schedules/${r.id}`, { method: "DELETE" })));
                await fetchTvs();
                onRefresh?.();
                setConfirmAction(null);
            },
        });
    };

    const saveRule = async () => {
        if (!scheduleModal) return;
        let res: Response;
        if (scheduleModal.mode === "add") {
            res = await fetch("/api/schedules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    speakerName: scheduleModal.speakerName,
                    speakerIp: scheduleModal.speakerIp,
                    channelType: "lgtv",
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
            alert(data.error || "Failed to save schedule rule");
            return;
        }
        setScheduleModal(null);
        setRuleForm({ dayOfWeek: 0, startTime: "08:00", endTime: "22:00" });
        fetchTvs();
    };

    useEffect(() => { fetchTvs(); }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">LG TV Output</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        When TV schedule is active and TV is on, alerts display as overlay — speakers are skipped.
                        If TV is off, alerts fall back to active speakers.
                    </p>
                </div>
                <button
                    onClick={() => { setShowAddTv(true); setPairStatus(null); setNewName(""); setNewIp(""); }}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-sm transition-all whitespace-nowrap"
                >
                    + Add LG TV
                </button>
            </div>

            {tvs.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-2xl border border-warm-200">
                    <div className="text-4xl mb-3">📺</div>
                    <h3 className="text-base font-semibold text-gray-700 mb-1">No LG TVs configured</h3>
                    <p className="text-sm text-gray-400">Click &quot;+ Add LG TV&quot; to connect your LG C2.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {tvs.map((tv) => (
                        <div key={tv.speakerName} className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
                            {/* TV card header */}
                            <div className="px-5 py-4 border-b border-blue-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-blue-50/40">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center shrink-0">
                                        <span className="text-lg">📺</span>
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-semibold text-gray-900 truncate">{tv.speakerName}</h3>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            {tv.speakerIp && (
                                                <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-md border truncate">
                                                    {tv.speakerIp}
                                                </span>
                                            )}
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${tv.isPaired ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                                                {tv.isPaired ? "● Paired" : "○ Not paired"}
                                            </span>
                                            <button
                                                onClick={() => deleteTv(tv)}
                                                className="text-xs font-semibold text-red-500 hover:bg-red-50 px-2 py-0.5 rounded-md transition-colors"
                                            >
                                                🗑️ Remove
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                {/* Action buttons */}
                                <div className="flex gap-2 shrink-0">
                                    <button
                                        onClick={() => tv.speakerIp && repairTv(tv.speakerName, tv.speakerIp)}
                                        disabled={pairing || !tv.speakerIp}
                                        className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-all"
                                    >
                                        {pairing ? (
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-3 h-3 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
                                                Pairing…
                                            </span>
                                        ) : tv.isPaired ? "Re-pair" : "Pair"}
                                    </button>
                                </div>
                            </div>

                            {/* Pair status banner */}
                            {pairStatus && (
                                <div className={`px-5 py-2.5 text-xs font-medium ${pairStatus.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                                    {pairStatus.success ? "✓" : "✕"} {pairStatus.message}
                                </div>
                            )}

                            {/* Test notification row */}
                            <div className="px-5 py-3 border-b border-blue-50 flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Enter test message..."
                                    value={customMessages[tv.speakerName] || ""}
                                    onChange={(e) => setCustomMessages({ ...customMessages, [tv.speakerName]: e.target.value })}
                                    className="flex-1 px-3 py-1.5 rounded-xl border border-warm-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-0"
                                />
                                <button
                                    onClick={() => tv.speakerIp && testTv(tv.speakerName, tv.speakerIp)}
                                    disabled={testing === tv.speakerName || !tv.isPaired || !tv.speakerIp}
                                    className="px-4 py-1.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 transition-all shrink-0 flex items-center gap-1.5"
                                >
                                    {testing === tv.speakerName
                                        ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        : "📺 Test"}
                                </button>
                            </div>
                            {testResult && testResult.tv === tv.speakerName && (
                                <div className={`px-5 py-2 text-xs font-medium ${testResult.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                                    {testResult.success ? "✓" : "✕"} {testResult.message}
                                </div>
                            )}

                            {/* Schedule — Global overlay */}
                            {(() => {
                                const globalRule = tv.rules.find((r) => r.dayOfWeek === -1);
                                return (
                                    <div className="px-5 py-3 bg-indigo-50/50 border-b border-blue-50">
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
                                                        <span className={`text-sm font-medium ${globalRule.enabled ? "text-indigo-800" : "text-gray-400 line-through"}`}>
                                                            {globalRule.startTime} – {globalRule.endTime}
                                                        </span>
                                                        <button
                                                            onClick={() => { setScheduleModal({ mode: "edit", ruleId: globalRule.id, speakerName: tv.speakerName, speakerIp: tv.speakerIp || undefined }); setRuleForm({ dayOfWeek: -1, startTime: globalRule.startTime, endTime: globalRule.endTime }); }}
                                                            className="text-indigo-400 hover:text-indigo-600 transition-colors p-1"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                                                        </button>
                                                        <button onClick={() => deleteRule(globalRule.id)} className="text-indigo-400 hover:text-red-500 transition-colors p-1 mr-1">
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                                                        </button>
                                                        <button onClick={() => toggleRule(globalRule)} className={`relative w-8 h-4.5 rounded-full transition-colors ${globalRule.enabled ? "bg-indigo-500" : "bg-gray-300"}`}>
                                                            <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform ${globalRule.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => { setScheduleModal({ mode: "add", speakerName: tv.speakerName, speakerIp: tv.speakerIp || undefined }); setRuleForm({ dayOfWeek: -1, startTime: "08:00", endTime: "22:00" }); }}
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

                            {/* Daily schedules */}
                            <div className="divide-y divide-blue-50 relative">
                                {(() => {
                                    const globalRule = tv.rules.find((r) => r.dayOfWeek === -1);
                                    const hasActiveGlobal = globalRule?.enabled;
                                    return (
                                        <>
                                            {hasActiveGlobal && (
                                                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                                                    <div className="bg-white/90 px-4 py-2 rounded-xl shadow-sm border border-blue-100 text-sm font-medium text-gray-500">
                                                        Daily settings disabled while Global Time is active
                                                    </div>
                                                </div>
                                            )}
                                            {DAYS.map((day, dayIndex) => {
                                                const dayRules = tv.rules.filter((r) => r.dayOfWeek === dayIndex);
                                                return (
                                                    <div key={dayIndex} className="px-5 py-3">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm font-medium text-gray-600 w-12">{day}</span>
                                                            <div className="flex-1 flex items-center gap-2 flex-wrap">
                                                                {dayRules.length === 0 ? (
                                                                    <span className="text-xs text-gray-300 italic">No schedule</span>
                                                                ) : (
                                                                    dayRules.map((rule) => (
                                                                        <div key={rule.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${rule.enabled ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-400"}`}>
                                                                            <span>{rule.startTime} – {rule.endTime}</span>
                                                                            <button onClick={() => toggleRule(rule)} className={`relative w-8 h-4.5 rounded-full transition-colors ${rule.enabled ? "bg-blue-400" : "bg-gray-300"}`}>
                                                                                <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform ${rule.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                                                                            </button>
                                                                            <button onClick={() => { setScheduleModal({ mode: "edit", ruleId: rule.id, speakerName: tv.speakerName, speakerIp: tv.speakerIp || undefined }); setRuleForm({ dayOfWeek: rule.dayOfWeek, startTime: rule.startTime, endTime: rule.endTime }); }} className="text-gray-400 hover:text-blue-500 transition-colors p-1">
                                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                                                                            </button>
                                                                            <button onClick={() => deleteRule(rule.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                                                                            </button>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={() => { setScheduleModal({ mode: "add", speakerName: tv.speakerName, speakerIp: tv.speakerIp || undefined }); setRuleForm({ dayOfWeek: dayIndex, startTime: "08:00", endTime: "22:00" }); }}
                                                                className="text-xs px-3 py-1.5 rounded-lg bg-warm-50 text-blue-600 hover:bg-blue-50 hover:text-blue-700 font-semibold ml-2 whitespace-nowrap transition-colors border border-warm-100 border-b-2"
                                                            >
                                                                + Add Time
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add TV modal */}
            {showAddTv && (
                <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-1">Add LG TV</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Enter the TV&apos;s name and IP, then click <strong>Pair</strong>. An &quot;Allow access?&quot; prompt will appear on the TV — accept it within 60 seconds.
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">TV Name</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="e.g. Living Room TV"
                                    disabled={pairing}
                                    className="w-full px-4 py-2.5 rounded-xl border border-warm-200 bg-warm-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">IP Address</label>
                                <input
                                    type="text"
                                    value={newIp}
                                    onChange={(e) => setNewIp(e.target.value)}
                                    placeholder="e.g. 192.168.1.150"
                                    disabled={pairing}
                                    className="w-full px-4 py-2.5 rounded-xl border border-warm-200 bg-warm-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                />
                            </div>
                        </div>

                        {pairing && (
                            <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-blue-50 rounded-xl text-sm text-blue-700">
                                <span className="w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin shrink-0" />
                                Waiting for TV… accept the prompt on your LG C2 (up to 60 s)
                            </div>
                        )}

                        {pairStatus && (
                            <div className={`mt-4 px-4 py-3 rounded-xl text-sm font-medium ${pairStatus.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                                {pairStatus.success ? "✓ " : "✕ "}{pairStatus.message}
                            </div>
                        )}

                        <div className="flex items-center gap-3 mt-6">
                            {!pairStatus?.success ? (
                                <button
                                    onClick={pairTv}
                                    disabled={pairing || !newName.trim() || !newIp.trim()}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-sm disabled:opacity-50 transition-all"
                                >
                                    {pairing ? "Pairing…" : "Pair TV"}
                                </button>
                            ) : (
                                <button
                                    onClick={() => { setShowAddTv(false); setPairStatus(null); }}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm transition-all"
                                >
                                    Done
                                </button>
                            )}
                            <button
                                onClick={() => { setShowAddTv(false); setPairStatus(null); setNewName(""); setNewIp(""); }}
                                disabled={pairing}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-warm-100 disabled:opacity-50 transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm delete modal */}
            {confirmAction && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4 mx-auto">
                                <span className="text-2xl">⚠️</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">{confirmAction.title}</h3>
                            <p className="text-sm text-gray-500 text-center mb-6">{confirmAction.message}</p>
                            <div className="flex gap-3">
                                <button onClick={() => setConfirmAction(null)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
                                <button onClick={confirmAction.onConfirm} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 shadow-sm transition-colors">Confirm Delete</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Schedule modal */}
            {scheduleModal && (
                <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">
                            {scheduleModal.mode === "add" ? "Add Time Schedule" : "Edit Time Schedule"}
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">For: <span className="font-medium text-gray-900">{scheduleModal.speakerName}</span></p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
                                <select value={ruleForm.dayOfWeek} onChange={(e) => setRuleForm((r) => ({ ...r, dayOfWeek: Number(e.target.value) }))} className="w-full px-4 py-2.5 rounded-xl border border-warm-200 bg-warm-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                                    <option value={-1}>🌍 Global Overlay</option>
                                    {FULL_DAYS.map((day, i) => <option key={i} value={i}>{day}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                                    <input type="time" value={ruleForm.startTime} onChange={(e) => setRuleForm((r) => ({ ...r, startTime: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-warm-200 bg-warm-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                                    <input type="time" value={ruleForm.endTime} onChange={(e) => setRuleForm((r) => ({ ...r, endTime: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-warm-200 bg-warm-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 mt-6">
                            <button onClick={saveRule} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-sm transition-all">
                                {scheduleModal.mode === "add" ? "Save New Schedule" : "Update Schedule"}
                            </button>
                            <button onClick={() => setScheduleModal(null)} className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-warm-100 transition-all">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

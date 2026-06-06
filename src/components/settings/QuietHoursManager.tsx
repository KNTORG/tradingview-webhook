"use client";

import { useState, useEffect } from "react";
import { FULL_DAYS, type MuteWindow } from "@/types/settings";

// crypto.randomUUID() only exists in secure contexts (HTTPS / localhost).
// Over plain-HTTP LAN access it's undefined, so fall back to a temporary id.
// The server assigns the real id on save; this is only a local React key.
function tempId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function QuietHoursManager() {
    const [windows, setWindows] = useState<MuteWindow[]>([]);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const fetchWindows = async () => {
        const res = await fetch("/api/settings/mute");
        const data = await res.json();
        setWindows(data.windows || []);
    };

    useEffect(() => {
        fetchWindows();
    }, []);

    const addWindow = () => {
        setWindows((prev) => [
            ...prev,
            {
                id: tempId(),
                dayOfWeek: -1,
                startTime: "11:00",
                endTime: "12:00",
                enabled: true,
            },
        ]);
    };

    const updateWindow = (id: string, patch: Partial<MuteWindow>) => {
        setWindows((prev) =>
            prev.map((w) => (w.id === id ? { ...w, ...patch } : w))
        );
    };

    const removeWindow = (id: string) => {
        setWindows((prev) => prev.filter((w) => w.id !== id));
    };

    const save = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/settings/mute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ windows }),
            });
            const data = await res.json();
            if (data.windows) setWindows(data.windows);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-warm-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-warm-200">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                        <span className="text-base">🔕</span>
                    </div>
                    <h2 className="font-semibold text-gray-900">Quiet Hours / Do Not Disturb</h2>
                </div>
            </div>
            <div className="p-5 space-y-4">
                <p className="text-xs text-gray-500">
                    Alerts that arrive during these windows are logged but not announced on any speaker or TV.
                </p>

                {windows.length === 0 ? (
                    <p className="text-sm text-gray-300 italic">No quiet hours configured.</p>
                ) : (
                    <div className="space-y-2">
                        {windows.map((w) => (
                            <div
                                key={w.id}
                                className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border border-warm-200 bg-warm-50"
                            >
                                <select
                                    value={w.dayOfWeek}
                                    onChange={(e) =>
                                        updateWindow(w.id, { dayOfWeek: Number(e.target.value) })
                                    }
                                    className="px-3 py-2 rounded-lg border border-warm-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                                >
                                    <option value={-1}>Every day</option>
                                    {FULL_DAYS.map((day, idx) => (
                                        <option key={idx} value={idx}>{day}</option>
                                    ))}
                                </select>

                                <input
                                    type="time"
                                    value={w.startTime}
                                    onChange={(e) => updateWindow(w.id, { startTime: e.target.value })}
                                    className="px-3 py-2 rounded-lg border border-warm-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                                />
                                <span className="text-gray-400 text-sm">–</span>
                                <input
                                    type="time"
                                    value={w.endTime}
                                    onChange={(e) => updateWindow(w.id, { endTime: e.target.value })}
                                    className="px-3 py-2 rounded-lg border border-warm-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                                />

                                <button
                                    onClick={() => updateWindow(w.id, { enabled: !w.enabled })}
                                    title={w.enabled ? "Enabled" : "Disabled"}
                                    className={`relative w-10 h-5 rounded-full transition-colors ${w.enabled ? "bg-purple-400" : "bg-gray-300"}`}
                                >
                                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${w.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                                </button>

                                <button
                                    onClick={() => removeWindow(w.id)}
                                    title="Remove"
                                    className="ml-auto text-gray-400 hover:text-red-500 transition-colors p-1"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-between pt-2">
                    <button
                        onClick={addWindow}
                        className="px-3 py-2 rounded-xl text-xs font-semibold border border-warm-200 text-gray-600 hover:bg-warm-100 transition-all"
                    >
                        + Add quiet window
                    </button>
                    <button
                        onClick={save}
                        disabled={saving}
                        className="px-8 py-2.5 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 transition-all shadow-sm"
                    >
                        {saving ? "Saving..." : saved ? "✓ Saved!" : "Save Quiet Hours"}
                    </button>
                </div>
            </div>
        </div>
    );
}

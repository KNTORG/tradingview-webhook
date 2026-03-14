"use client";

import { useState } from "react";
import { DiscoveredSpeaker } from "@/types/settings";

interface SpeakerDiscoveryProps {
    onRefresh: () => void;
}

export default function SpeakerDiscovery({ onRefresh }: SpeakerDiscoveryProps) {
    const [discovered, setDiscovered] = useState<DiscoveredSpeaker[]>([]);
    const [discovering, setDiscovering] = useState(false);
    const [showAddSpeaker, setShowAddSpeaker] = useState(false);
    const [newSpeakerName, setNewSpeakerName] = useState("");
    const [newSpeakerIp, setNewSpeakerIp] = useState("");

    const discoverSpeakers = async () => {
        setDiscovering(true);
        try {
            const res = await fetch("/api/speakers");
            const data = await res.json();
            setDiscovered(data.speakers || []);
        } catch (err) {
            console.error("Failed to discover speakers:", err);
        } finally {
            setDiscovering(false);
        }
    };

    const addSpeakerWithDefaults = async () => {
        try {
            for (let day = 0; day <= 6; day++) {
                await fetch("/api/schedules", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        speakerName: newSpeakerName,
                        speakerIp: newSpeakerIp,
                        dayOfWeek: day,
                        startTime: "08:00",
                        endTime: "22:00",
                    }),
                });
            }
            setShowAddSpeaker(false);
            setNewSpeakerName("");
            setNewSpeakerIp("");
            onRefresh();
        } catch (err) {
            console.error("Failed to add speaker:", err);
        }
    };

    return (
        <>
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
        </>
    );
}

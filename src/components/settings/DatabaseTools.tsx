"use client";

import { useState, useEffect } from "react";
import { PurgeStats } from "@/types/settings";

export default function DatabaseTools() {
    const [purgeStats, setPurgeStats] = useState<PurgeStats | null>(null);
    const [purgeDays, setPurgeDays] = useState<number>(30);
    const [purging, setPurging] = useState(false);
    const [purgeConfirm, setPurgeConfirm] = useState(false);
    const [purgeResult, setPurgeResult] = useState<string | null>(null);

    const fetchPurgeStats = async () => {
        const res = await fetch("/api/messages/purge");
        const data = await res.json();
        setPurgeStats(data);
    };

    const purgeMessages = async () => {
        setPurging(true);
        try {
            const res = await fetch(`/api/messages/purge?olderThanDays=${purgeDays}`, {
                method: "DELETE",
            });
            const data = await res.json();
            setPurgeResult(data.message);
            setPurgeConfirm(false);
            await fetchPurgeStats();
        } finally {
            setPurging(false);
        }
    };

    useEffect(() => {
        fetchPurgeStats();
    }, []);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-warm-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-warm-200">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                        <span className="text-base">🗄️</span>
                    </div>
                    <h2 className="font-semibold text-gray-900">Database Maintenance</h2>
                </div>
            </div>
            <div className="p-5">
                {/* Stats grid */}
                {purgeStats && (
                    <div className="grid grid-cols-3 gap-4 mb-5">
                        <div className="bg-warm-50 rounded-xl p-4 text-center">
                            <div className="text-2xl font-bold text-gray-900">{purgeStats.totalMessages.toLocaleString()}</div>
                            <div className="text-xs text-gray-500 mt-1">Total Messages</div>
                        </div>
                        <div className="bg-warm-50 rounded-xl p-4 text-center">
                            <div className="text-2xl font-bold text-gray-900">{purgeStats.dbSizeFormatted}</div>
                            <div className="text-xs text-gray-500 mt-1">Database Size</div>
                        </div>
                        <div className="bg-warm-50 rounded-xl p-4 text-center">
                            <div className="text-2xl font-bold text-gray-900">
                                {purgeStats.oldestMessageDate
                                    ? new Date(purgeStats.oldestMessageDate).toLocaleDateString("en-US", {
                                        timeZone: process.env.NEXT_PUBLIC_TZ || "Asia/Bangkok",
                                    })
                                    : "—"}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">Oldest Message</div>
                        </div>
                    </div>
                )}
                {/* Purge controls */}
                <div className="flex items-end gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Delete messages older than</label>
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
                {purgeResult && (
                    <div className="mt-3 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
                        {purgeResult}
                    </div>
                )}
            </div>
        </div>
    );
}

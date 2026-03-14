"use client";

import { useState, useEffect, useCallback } from "react";

interface Message {
    id: string;
    text: string;
    receivedAt: string;
    status: string;
    speakers: string[];
    error?: string;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export default function Dashboard() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
    });
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    const [webhookSecret, setWebhookSecret] = useState<string>("dev-secret-change-me");
    const [publicUrl, setPublicUrl] = useState<string>("");

    // Test alert state
    const [testMessage, setTestMessage] = useState("Test alert from dashboard");
    const [sendingTest, setSendingTest] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    // Export state
    const [exportDates, setExportDates] = useState({
        startDate: "",
        endDate: "",
    });

    const webhookUrl =
        publicUrl.trim() 
            ? `${publicUrl.replace(/\/$/, "")}/api/webhook/${webhookSecret}`
            : typeof window !== "undefined"
                ? `${window.location.protocol}//${window.location.hostname}:${window.location.port || "12345"}/api/webhook/${webhookSecret}`
                : `http://your-ip:12345/api/webhook/${webhookSecret}`;

    const fetchMessages = useCallback(async (page: number) => {
        try {
            const res = await fetch(`/api/messages?page=${page}&limit=20`);
            const data = await res.json();
            setMessages(data.messages);
            setPagination(data.pagination);
        } catch (err) {
            console.error("Failed to fetch messages:", err);
        } finally {
            setLoading(false);
        }
    }, []);
    const fetchWebhookSecret = useCallback(async () => {
        try {
            const res = await fetch("/api/settings/webook");
            if (res.ok) {
                const data = await res.json();
                if (data.secret) setWebhookSecret(data.secret);
                if (data.publicUrl) setPublicUrl(data.publicUrl);
            }
        } catch (err) {
            console.error("Failed to fetch settings:", err);
        }
    }, []);

    useEffect(() => {
        fetchMessages(pagination.page);
        fetchWebhookSecret();

        // Polling as fallback
        const interval = setInterval(() => {
            fetchMessages(pagination.page);
        }, 10000);

        // SSE for real-time updates
        let eventSource: EventSource | null = null;
        try {
            eventSource = new EventSource("/api/messages/stream");
            eventSource.onmessage = () => fetchMessages(pagination.page);
            eventSource.onerror = () => {
                // SSE failed — polling continues as fallback
            };
        } catch {
            // SSE not supported — polling continues
        }

        return () => {
            clearInterval(interval);
            eventSource?.close();
        };
    }, [pagination.page, fetchMessages, fetchWebhookSecret]);

    const copyWebhookUrl = () => {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(webhookUrl);
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = webhookUrl;
            textArea.style.position = "fixed";  // Avoid scrolling to bottom
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
            } catch (err) {
                console.error('Fallback: copy failed', err);
            }
            document.body.removeChild(textArea);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const sendTestAlert = async () => {
        setSendingTest(true);
        setTestResult(null);
        try {
            const res = await fetch(`/api/webhook/${webhookSecret}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: testMessage }),
            });
            const data = await res.json();
            if (res.ok) {
                setTestResult({ success: true, message: `Alert sent (${data.status})` });
            } else {
                setTestResult({ success: false, message: data.error || "Failed to send" });
            }
        } catch (err) {
            setTestResult({ success: false, message: err instanceof Error ? err.message : "Failed" });
        } finally {
            setSendingTest(false);
            setTimeout(() => setTestResult(null), 4000);
        }
    };

    const handleExport = () => {
        const params = new URLSearchParams();
        if (exportDates.startDate) params.append("startDate", exportDates.startDate);
        if (exportDates.endDate) params.append("endDate", exportDates.endDate);
        window.open(`/api/messages/export?${params.toString()}`, "_blank");
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return new Intl.DateTimeFormat("en-US", {
            timeZone: process.env.NEXT_PUBLIC_TZ || "Asia/Bangkok",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
        }).format(d);
    };

    const statusConfig: Record<string, { label: string; classes: string }> = {
        spoken: {
            label: "Spoken",
            classes:
                "bg-emerald-50 text-emerald-700 border border-emerald-200",
        },
        silenced: {
            label: "Silenced",
            classes:
                "bg-amber-50 text-amber-700 border border-amber-200",
        },
        failed: {
            label: "Failed",
            classes: "bg-red-50 text-red-700 border border-red-200",
        },
        pending: {
            label: "Pending",
            classes:
                "bg-blue-50 text-blue-700 border border-blue-200",
        },
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Monitor incoming TradingView alerts and their delivery status
                </p>
            </div>

            {/* Webhook URL Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-5">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-coral-50 flex items-center justify-center">
                            <svg
                                className="w-4 h-4 text-coral-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={2}
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
                                />
                            </svg>
                        </div>
                        <h2 className="font-semibold text-gray-900">
                            Webhook URL
                        </h2>
                    </div>
                    <span className="text-xs text-gray-400">
                        Paste this in TradingView alert webhook field
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex-1 bg-warm-50 border border-warm-200 rounded-xl px-4 py-3 font-mono text-sm text-gray-600 overflow-hidden text-ellipsis whitespace-nowrap">
                        {webhookUrl}
                    </div>
                    <button
                        onClick={copyWebhookUrl}
                        className={`px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm ${copied
                            ? "bg-emerald-500 text-white"
                            : "bg-gradient-to-r from-coral-400 to-coral-500 text-white hover:from-coral-500 hover:to-coral-600 hover:shadow-md"
                            }`}
                    >
                        {copied ? "✓ Copied" : "Copy"}
                    </button>
                </div>
            </div>

            {/* Test Alert Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                        </svg>
                    </div>
                    <h2 className="font-semibold text-gray-900">Send Test Alert</h2>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        value={testMessage}
                        onChange={(e) => setTestMessage(e.target.value)}
                        placeholder="Enter test message..."
                        className="flex-1 bg-warm-50 border border-warm-200 rounded-xl px-4 py-3 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-coral-300"
                    />
                    <button
                        onClick={sendTestAlert}
                        disabled={sendingTest || !testMessage.trim()}
                        className="px-5 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-400 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-600 hover:shadow-md shadow-sm disabled:opacity-50 transition-all flex items-center gap-2"
                    >
                        {sendingTest ? (
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            "Send Test"
                        )}
                    </button>
                </div>
                {testResult && (
                    <div className={`mt-3 px-4 py-2 rounded-xl text-sm font-medium ${testResult.success ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                        {testResult.success ? "✓" : "✕"} {testResult.message}
                    </div>
                )}
            </div>

            {/* Messages Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-warm-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-warm-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-gray-900">Recent Alerts</h2>
                        <span className="text-xs bg-warm-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                            {pagination.total} total
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={exportDates.startDate}
                                onChange={(e) => setExportDates({ ...exportDates, startDate: e.target.value })}
                                className="px-3 py-1.5 rounded-lg border border-warm-200 text-xs focus:outline-none focus:ring-2 focus:ring-coral-300 bg-warm-50"
                                placeholder="Start Date"
                            />
                            <span className="text-gray-400 text-xs font-medium">to</span>
                            <input
                                type="date"
                                value={exportDates.endDate}
                                onChange={(e) => setExportDates({ ...exportDates, endDate: e.target.value })}
                                className="px-3 py-1.5 rounded-lg border border-warm-200 text-xs focus:outline-none focus:ring-2 focus:ring-coral-300 bg-warm-50"
                                placeholder="End Date"
                            />
                        </div>
                        <button
                            onClick={handleExport}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-warm-200 text-gray-700 hover:bg-warm-50 hover:border-warm-300 transition-all shadow-sm flex items-center gap-2"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            Export CSV
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="flex items-center gap-3 text-gray-400">
                            <div className="w-5 h-5 border-2 border-coral-300 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm">Loading messages...</span>
                        </div>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <svg
                            className="w-12 h-12 mb-3 text-warm-200"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
                            />
                        </svg>
                        <p className="text-sm font-medium">No alerts yet</p>
                        <p className="text-xs mt-1">
                            Alerts will appear here when TradingView sends webhooks
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-warm-50">
                                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Time
                                    </th>
                                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Message
                                    </th>
                                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Speakers
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-warm-100">
                                {messages.map((msg) => {
                                    const status = statusConfig[msg.status] || statusConfig.pending;
                                    return (
                                        <tr
                                            key={msg.id}
                                            className="hover:bg-warm-50 transition-colors"
                                        >
                                            <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">
                                                {formatTime(msg.receivedAt)}
                                            </td>
                                            <td className="px-5 py-4 text-sm text-gray-900 font-medium max-w-md">
                                                <div className="truncate" title={msg.text}>
                                                    {msg.text}
                                                </div>
                                                {msg.error && (
                                                    <div className="text-xs text-red-500 mt-1 truncate" title={msg.error}>
                                                        ⚠ {msg.error}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${status.classes}`}
                                                >
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-sm text-gray-500">
                                                {msg.speakers.length > 0
                                                    ? msg.speakers.join(", ")
                                                    : "—"}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="px-5 py-4 border-t border-warm-200 flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                            Showing{" "}
                            <span className="font-medium">
                                {(pagination.page - 1) * pagination.limit + 1}
                            </span>{" "}
                            to{" "}
                            <span className="font-medium">
                                {Math.min(
                                    pagination.page * pagination.limit,
                                    pagination.total
                                )}
                            </span>{" "}
                            of{" "}
                            <span className="font-medium">{pagination.total}</span> alerts
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() =>
                                    setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))
                                }
                                disabled={pagination.page === 1}
                                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-warm-200 text-gray-600 hover:bg-warm-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                ‹ Prev
                            </button>
                            {Array.from(
                                { length: Math.min(5, pagination.totalPages) },
                                (_, i) => {
                                    const start = Math.max(
                                        1,
                                        Math.min(
                                            pagination.page - 2,
                                            pagination.totalPages - 4
                                        )
                                    );
                                    const pageNum = start + i;
                                    if (pageNum > pagination.totalPages) return null;
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() =>
                                                setPagination((p) => ({ ...p, page: pageNum }))
                                            }
                                            className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${pageNum === pagination.page
                                                ? "bg-coral-500 text-white shadow-sm"
                                                : "text-gray-600 hover:bg-warm-100"
                                                }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                }
                            )}
                            <button
                                onClick={() =>
                                    setPagination((p) => ({
                                        ...p,
                                        page: Math.min(p.totalPages, p.page + 1),
                                    }))
                                }
                                disabled={pagination.page === pagination.totalPages}
                                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-warm-200 text-gray-600 hover:bg-warm-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Next ›
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

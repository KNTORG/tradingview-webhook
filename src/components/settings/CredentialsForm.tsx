"use client";

import { useState, useEffect } from "react";

export default function CredentialsForm() {
    const [webhookSecret, setWebhookSecret] = useState("");
    const [publicUrl, setPublicUrl] = useState("");
    const [savingSecret, setSavingSecret] = useState(false);
    const [secretSaved, setSecretSaved] = useState(false);
    const [authForm, setAuthForm] = useState({ username: "", password: "" });
    const [savingAuth, setSavingAuth] = useState(false);
    const [authSaved, setAuthSaved] = useState(false);
    const [authError, setAuthError] = useState("");

    const generateSecret = () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let result = "";
        for (let i = 0; i < 16; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setWebhookSecret(result);
    };

    const fetchWebhookSecret = async () => {
        const res = await fetch("/api/settings/webook");
        const data = await res.json();
        setWebhookSecret(data.secret);
        setPublicUrl(data.publicUrl);
    };

    const saveWebhookSecret = async () => {
        setSavingSecret(true);
        try {
            await fetch("/api/settings/webook", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ secret: webhookSecret, publicUrl }),
            });
            setSecretSaved(true);
            setTimeout(() => setSecretSaved(false), 2000);
        } finally {
            setSavingSecret(false);
        }
    };

    const saveAuthCredentials = async () => {
        if (!authForm.username || !authForm.password) return;
        setSavingAuth(true);
        setAuthError("");
        try {
            const res = await fetch("/api/auth/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(authForm),
            });
            if (!res.ok) {
                const data = await res.json();
                setAuthError(data.message || "Failed to update credentials");
                return;
            }
            setAuthSaved(true);
            setTimeout(() => setAuthSaved(false), 2000);
            setAuthForm({ username: "", password: "" });
        } catch {
            setAuthError("Failed to update credentials");
        } finally {
            setSavingAuth(false);
        }
    };

    useEffect(() => {
        fetchWebhookSecret();
    }, []);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-warm-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-warm-200">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <span className="text-base">⚙️</span>
                    </div>
                    <h2 className="font-semibold text-gray-900">System Settings</h2>
                </div>
            </div>
            <div className="p-5 space-y-6">
                {/* Public URL */}
                <div className="max-w-2xl">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Public URL / Domain Configuration</label>
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
                {/* Webhook Secret */}
                <div className="max-w-2xl">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Webhook Secret Configuration</label>
                    <p className="text-xs text-gray-500 mb-3">
                        Customize the secret path used in your TradingView webhook URL (e.g., set to <code>my-secret-key</code> for <code>/api/webhook/my-secret-key</code>).
                    </p>
                    <div className="flex items-center gap-3">
                        <div className="flex-1 relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">/api/webhook/</span>
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
                {/* Auth credentials */}
                <div className="max-w-2xl pt-6 border-t border-warm-100 mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Dashboard Security (Login Credentials)</label>
                    <p className="text-xs text-gray-500 mb-3">Update the username and password used to access this dashboard.</p>
                    {authError && (
                        <div className="mb-3 p-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl">{authError}</div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">New Username</label>
                            <input
                                type="text"
                                value={authForm.username}
                                onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                                placeholder="Enter new username"
                                className="w-full px-4 py-2.5 rounded-xl border border-warm-200 bg-warm-50 text-sm focus:outline-none focus:ring-2 focus:ring-coral-300 transition-all mb-2"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">New Password</label>
                            <input
                                type="password"
                                value={authForm.password}
                                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                                placeholder="Enter new password"
                                className="w-full px-4 py-2.5 rounded-xl border border-warm-200 bg-warm-50 text-sm focus:outline-none focus:ring-2 focus:ring-coral-300 transition-all mb-2"
                            />
                        </div>
                    </div>
                    <div className="flex justify-start mt-2">
                        <button
                            onClick={saveAuthCredentials}
                            disabled={savingAuth || !authForm.username || !authForm.password}
                            className="px-5 py-2 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 transition-all shadow-sm"
                        >
                            {savingAuth ? "Updating..." : authSaved ? "✓ Updated!" : "Update Credentials"}
                        </button>
                    </div>
                </div>
                {/* Save all settings button */}
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
    );
}

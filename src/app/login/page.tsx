"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            if (res.ok) {
                router.push("/");
                router.refresh();
            } else {
                const data = await res.json();
                setError(data.error || "Login failed");
            }
        } catch (err) {
            setError("An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-warm-200 p-8">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-coral-400 to-coral-600 flex items-center justify-center shadow-md mx-auto mb-4">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Login Required</h1>
                    <p className="text-sm text-gray-500 mt-1">Please sign in to access the dashboard</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl">
                            {error}
                        </div>
                    )}
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="w-full px-4 py-3 rounded-xl border border-warm-200 bg-warm-50 focus:outline-none focus:ring-2 focus:ring-coral-300 focus:bg-white transition-all text-sm"
                            placeholder="Enter username"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full px-4 py-3 rounded-xl border border-warm-200 bg-warm-50 focus:outline-none focus:ring-2 focus:ring-coral-300 focus:bg-white transition-all text-sm"
                            placeholder="Enter password"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 bg-gradient-to-r from-coral-400 to-coral-500 hover:from-coral-500 hover:to-coral-600 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                    >
                        {loading ? "Signing in..." : "Sign In"}
                    </button>
                </form>
            </div>
        </div>
    );
}

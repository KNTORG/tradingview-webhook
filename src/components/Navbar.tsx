"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
    };

    const links = [
        { href: "/", label: "Dashboard", icon: "📊" },
        { href: "/settings", label: "Settings", icon: "⚙️" },
    ];

    return (
        <nav className="bg-white border-b border-warm-200 sticky top-0 z-50 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center gap-8">
                        <Link href="/" className="flex items-center gap-2.5 group">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-coral-400 to-coral-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
                                <svg
                                    className="w-5 h-5 text-white"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2}
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
                                    />
                                </svg>
                            </div>
                            <span className="text-lg font-bold text-gray-900 tracking-tight">
                                Trade Alert Speaker
                            </span>
                        </Link>

                        <div className="flex items-center gap-1">
                            {links.map((link) => {
                                const isActive = pathname === link.href;
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                                ? "bg-coral-50 text-coral-600 shadow-sm"
                                                : "text-gray-500 hover:text-gray-700 hover:bg-warm-100"
                                            }`}
                                    >
                                        <span className="mr-1.5">{link.icon}</span>
                                        {link.label}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs font-medium text-gray-400">
                                Listening for alerts
                            </span>
                        </div>
                        {pathname !== "/login" && (
                            <button
                                onClick={handleLogout}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                                Logout
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}

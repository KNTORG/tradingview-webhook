"use client";

import { useState, useCallback } from "react";
import SpeakerDiscovery from "@/components/settings/SpeakerDiscovery";
import ScheduleManager from "@/components/settings/ScheduleManager";
import DatabaseTools from "@/components/settings/DatabaseTools";
import CredentialsForm from "@/components/settings/CredentialsForm";

export default function SettingsPage() {
    const [refreshKey, setRefreshKey] = useState(0);
    const onRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Configure speaker schedules and manage your database
                </p>
            </div>

            {/* Speaker Discovery + Add */}
            <SpeakerDiscovery onRefresh={onRefresh} />

            {/* Speaker Schedule Cards */}
            <ScheduleManager key={refreshKey} />

            {/* Database Maintenance */}
            <DatabaseTools />

            {/* System Settings */}
            <CredentialsForm />
        </div>
    );
}

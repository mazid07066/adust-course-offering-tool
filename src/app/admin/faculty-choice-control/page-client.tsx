"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";

export default function PageClient() {
  const [sessionMinutes, setSessionMinutes] = useState(30);
  const [windowStatus, setWindowStatus] = useState("CLOSED");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const res = await fetch("/api/system-settings");
    const data = await res.json();

    setSessionMinutes(data.sessionMinutes);
    setWindowStatus(data.windowStatus);
  }

  async function updateSetting(key: string, value: string | number) {
    setLoading(true);

    await fetch("/api/system-settings/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ key, value }),
    });

    await loadSettings();
    setLoading(false);
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold">
          Faculty Choice Control Panel
        </h1>

        {/* SESSION MINUTES */}
        <div className="border rounded-xl p-4 space-y-3">
          <h2 className="text-lg font-medium">
            Faculty Session Duration (minutes)
          </h2>

          <input
            type="number"
            value={sessionMinutes}
            onChange={(e) => setSessionMinutes(Number(e.target.value))}
            className="border px-3 py-2 rounded w-40"
          />

          <button
            onClick={() =>
              updateSetting("FACULTY_SESSION_MINUTES", sessionMinutes)
            }
            className="bg-blue-600 text-white px-4 py-2 rounded"
            disabled={loading}
          >
            Save Session Duration
          </button>
        </div>

        {/* WINDOW CONTROL */}
        <div className="border rounded-xl p-4 space-y-3">
          <h2 className="text-lg font-medium">
            Faculty Choice Window
          </h2>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() =>
                updateSetting("FACULTY_CHOICE_WINDOW_STATUS", "OPEN")
              }
              className={`px-4 py-2 rounded ${
                windowStatus === "OPEN"
                  ? "bg-green-600 text-white"
                  : "bg-gray-200"
              }`}
            >
              OPEN
            </button>

            <button
              onClick={() =>
                updateSetting("FACULTY_CHOICE_WINDOW_STATUS", "CLOSED")
              }
              className={`px-4 py-2 rounded ${
                windowStatus === "CLOSED"
                  ? "bg-red-600 text-white"
                  : "bg-gray-200"
              }`}
            >
              CLOSED
            </button>

            <button
              onClick={() =>
                updateSetting("FACULTY_CHOICE_WINDOW_STATUS", "FINAL_LOCKED")
              }
              className={`px-4 py-2 rounded ${
                windowStatus === "FINAL_LOCKED"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-200"
              }`}
            >
              FINAL LOCK
            </button>
          </div>

          <p className="text-sm text-gray-600">
            Current Status: <b>{windowStatus}</b>
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
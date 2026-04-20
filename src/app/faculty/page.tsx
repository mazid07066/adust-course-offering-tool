"use client";

import { useState } from "react";

export default function FacultyPage() {
  const [message, setMessage] = useState("");

  async function testAction() {
    const res = await fetch("/api/faculty/test-action", {
      method: "POST",
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error);
    } else {
      setMessage("SUCCESS: " + data.message);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Faculty Panel</h1>

      <button
        onClick={testAction}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Test Faculty Action
      </button>

      <div>{message}</div>
    </div>
  );
}
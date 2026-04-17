"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";

type Room = {
  id: number;
  room_code: string;
  room_type: string;
  capacity: number | null;
  is_active: boolean | null;
};

export default function RoomsPageClient() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [roomCode, setRoomCode] = useState("");
  const [roomType, setRoomType] = useState("");
  const [capacity, setCapacity] = useState("");

  async function loadRooms() {
    try {
      const res = await fetch("/api/rooms/manage", {
        cache: "no-store",
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load rooms");

      setRooms(json.rooms || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rooms");
    }
  }

  useEffect(() => {
    loadRooms();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/rooms/manage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          room_code: roomCode,
          room_type: roomType,
          capacity: capacity ? Number(capacity) : null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create room");

      setRoomCode("");
      setRoomType("");
      setCapacity("");
      setMessage("Room created successfully.");
      await loadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    }
  }

  async function handleDelete(id: number) {
    const ok = window.confirm("Delete this room?");
    if (!ok) return;

    try {
      const res = await fetch(`/api/rooms/manage/${id}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete room");

      setMessage("Room deleted successfully.");
      await loadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete room");
    }
  }

  return (
    <AdminLayout title="Rooms">
      <div className="space-y-6">
        <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-4">
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="Room Code"
            className="rounded-xl border px-4 py-3"
          />

          <input
            value={roomType}
            onChange={(e) => setRoomType(e.target.value.toUpperCase())}
            placeholder="Room Type"
            className="rounded-xl border px-4 py-3"
          />

          <input
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="Capacity"
            className="rounded-xl border px-4 py-3"
          />

          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            Add Room
          </button>
        </form>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b px-3 py-3 text-left">Room Code</th>
                <th className="border-b px-3 py-3 text-left">Type</th>
                <th className="border-b px-3 py-3 text-left">Capacity</th>
                <th className="border-b px-3 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td className="border-b px-3 py-2">{room.room_code}</td>
                  <td className="border-b px-3 py-2">{room.room_type}</td>
                  <td className="border-b px-3 py-2">{room.capacity ?? "-"}</td>
                  <td className="border-b px-3 py-2">
                    <button
                      onClick={() => handleDelete(room.id)}
                      className="rounded-lg bg-red-600 px-3 py-2 text-white hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {rooms.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No rooms found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
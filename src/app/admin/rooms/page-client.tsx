"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";

type RoomRow = {
  id: number;
  roomCode: string;
  roomNumber: string;
  building: string;
  isActive: boolean;
  displayCode: string;
};

type RoomResponse = {
  ok?: boolean;
  error?: string;
  rooms?: RoomRow[];
  room?: RoomRow;
};

const BUILDINGS = ["BUILDING 1", "BUILDING 2", "BUILDING 3"];

export default function RoomsPageClient() {
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [roomCode, setRoomCode] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [building, setBuilding] = useState("BUILDING 1");
  const [isActive, setIsActive] = useState(true);

  const [editingId, setEditingId] = useState<number | null>(null);

  async function loadRooms() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/rooms", {
        method: "GET",
        cache: "no-store",
      });

      const json: RoomResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load rooms.");
      }

      setRooms(json.rooms || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rooms.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRooms();
  }, []);

  function resetForm() {
    setRoomCode("");
    setRoomNumber("");
    setBuilding("BUILDING 1");
    setIsActive(true);
    setEditingId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!roomCode.trim()) {
      setError("Room code is required.");
      setMessage("");
      return;
    }

    if (!roomNumber.trim()) {
      setError("Room number is required.");
      setMessage("");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const url = editingId ? `/api/rooms/${editingId}` : "/api/rooms";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomCode,
          roomNumber,
          building,
          isActive,
        }),
      });

      const json: RoomResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to save room.");
      }

      setMessage(editingId ? "Room updated successfully." : "Room created successfully.");
      resetForm();
      await loadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save room.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(roomId: number) {
    const ok = window.confirm("Delete this room?");
    if (!ok) return;

    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to delete room.");
      }

      setMessage("Room deleted successfully.");
      await loadRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete room.");
    }
  }

  function startEdit(room: RoomRow) {
    setEditingId(room.id);
    setRoomCode(room.roomCode);
    setRoomNumber(room.roomNumber);
    setBuilding(room.building);
    setIsActive(room.isActive);
    setMessage("");
    setError("");
  }

  return (
    <AdminLayout title="Rooms">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Room Setup</h3>
          <p className="mt-1 text-sm text-slate-500">
            Create and maintain rooms that will be used during slot scheduling.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Room Code
              </label>
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="w-full rounded-xl border px-4 py-3"
                placeholder="Example: RM"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Room Number
              </label>
              <input
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value.toUpperCase())}
                className="w-full rounded-xl border px-4 py-3"
                placeholder="Example: 504"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Building
              </label>
              <select
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                className="w-full rounded-xl border px-4 py-3"
              >
                {BUILDINGS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 pt-8">
              <input
                id="room-active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <label htmlFor="room-active" className="text-sm font-medium text-slate-700">
                Active
              </label>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saving
                ? editingId
                  ? "Updating..."
                  : "Saving..."
                : editingId
                ? "Update Room"
                : "Create Room"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl bg-slate-200 px-5 py-3 text-sm font-medium text-slate-800 hover:bg-slate-300"
              >
                Cancel Edit
              </button>
            )}
          </div>
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

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-base font-semibold text-slate-900">Configured Rooms</h4>
            <button
              type="button"
              onClick={loadRooms}
              className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-300"
            >
              {loading ? "Loading..." : "Reload"}
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b px-3 py-3 text-left">Room Code</th>
                  <th className="border-b px-3 py-3 text-left">Room Number</th>
                  <th className="border-b px-3 py-3 text-left">Building</th>
                  <th className="border-b px-3 py-3 text-left">Status</th>
                  <th className="border-b px-3 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id}>
                    <td className="border-b px-3 py-2">{room.roomCode}</td>
                    <td className="border-b px-3 py-2">{room.roomNumber}</td>
                    <td className="border-b px-3 py-2">{room.building}</td>
                    <td className="border-b px-3 py-2">
                      {room.isActive ? "Active" : "Inactive"}
                    </td>
                    <td className="border-b px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(room)}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(room.id)}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {rooms.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No rooms configured yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
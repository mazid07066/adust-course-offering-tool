"use client";

import { useEffect, useState } from "react";

type SetupRow = {
  id: number;
  department_code: string;
  department_name: string;
  program_code: string;
  program_title: string;
  program_type: string;
  study_shift: string;
  curriculum_version: string;
  student_id_suffix: string | null;
  display_label: string;
  is_active: boolean;
};

const PROGRAM_TYPES = ["REG", "EVE", "ACCELERATED", "OTHER"];
const SHIFTS = ["REG", "EVE", "ACCELERATED", "OTHER"];
const CURRICULUMS = ["NEW", "OLD", "OTHER"];

export default function AcademicSetupPageClient() {
  const [items, setItems] = useState<SetupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [departmentCode, setDepartmentCode] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [programCode, setProgramCode] = useState("");
  const [programTitle, setProgramTitle] = useState("");
  const [programType, setProgramType] = useState("REG");
  const [studyShift, setStudyShift] = useState("REG");
  const [curriculumVersion, setCurriculumVersion] = useState("NEW");
  const [studentIdSuffix, setStudentIdSuffix] = useState("");
  const [isActive, setIsActive] = useState(true);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/academic-setup/manage", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load academic setup.");
      }
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load academic setup.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/academic-setup/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentCode,
          departmentName,
          programCode,
          programTitle,
          programType,
          studyShift,
          curriculumVersion,
          studentIdSuffix,
          isActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save academic setup.");
      }

      setMessage(data.message || "Saved successfully.");
      setDepartmentCode("");
      setDepartmentName("");
      setProgramCode("");
      setProgramTitle("");
      setProgramType("REG");
      setStudyShift("REG");
      setCurriculumVersion("NEW");
      setStudentIdSuffix("");
      setIsActive(true);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save academic setup.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Primary Academic Identity Setup</h2>
        <p className="mt-1 text-sm text-slate-600">
          Configure the exact dropdown source for department, program, shift, curriculum, and student ID suffix.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Department Code</label>
            <input
              value={departmentCode}
              onChange={(e) => setDepartmentCode(e.target.value.toUpperCase())}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="EEE"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Department Name</label>
            <input
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="Electrical and Electronic Engineering"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Program Code</label>
            <input
              value={programCode}
              onChange={(e) => setProgramCode(e.target.value.toUpperCase())}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="BSC-EEE-REG-NEW"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Program Title</label>
            <input
              value={programTitle}
              onChange={(e) => setProgramTitle(e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="BSc EEE"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Program Type</label>
            <select
              value={programType}
              onChange={(e) => setProgramType(e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
            >
              {PROGRAM_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Study Shift</label>
            <select
              value={studyShift}
              onChange={(e) => setStudyShift(e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
            >
              {SHIFTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Curriculum Version</label>
            <select
              value={curriculumVersion}
              onChange={(e) => setCurriculumVersion(e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
            >
              {CURRICULUMS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Student ID Suffix (ZZZ)</label>
            <input
              value={studentIdSuffix}
              onChange={(e) => setStudentIdSuffix(e.target.value.toUpperCase())}
              className="w-full rounded-xl border px-3 py-2"
              placeholder="206"
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-2">
            <input
              id="isActive"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <label htmlFor="isActive" className="text-sm font-medium">
              Active
            </label>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Saving..." : "Save Academic Setup"}
            </button>
          </div>
        </form>

        {message ? <p className="mt-4 text-sm text-green-700">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      </div>

      <div className="rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Configured Academic Identities</h2>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="px-3 py-2">Department</th>
                <th className="px-3 py-2">Program Code</th>
                <th className="px-3 py-2">Program Title</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Shift</th>
                <th className="px-3 py-2">Curriculum</th>
                <th className="px-3 py-2">Suffix</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="px-3 py-2">{item.department_code}</td>
                  <td className="px-3 py-2">{item.program_code}</td>
                  <td className="px-3 py-2">{item.program_title}</td>
                  <td className="px-3 py-2">{item.program_type}</td>
                  <td className="px-3 py-2">{item.study_shift}</td>
                  <td className="px-3 py-2">{item.curriculum_version}</td>
                  <td className="px-3 py-2">{item.student_id_suffix || "-"}</td>
                  <td className="px-3 py-2">{item.is_active ? "Active" : "Inactive"}</td>
                </tr>
              ))}
              {!items.length ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={8}>
                    No academic setup rows found yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
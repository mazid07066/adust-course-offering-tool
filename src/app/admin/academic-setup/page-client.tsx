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

      setMessage(data.message || "Academic setup saved successfully.");
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
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Primary Academic Identity Setup</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Define the exact academic identities manually. No automatic seeded values are used.
            Every dropdown in the rest of the system will come from the rows saved here.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-7 text-slate-700">
          <p className="font-semibold text-slate-900">How to fill this form</p>

          <div className="mt-3 space-y-2">
            <p>
              <span className="font-semibold">Department Code:</span> short department code such as
              <span className="mx-1 rounded bg-white px-2 py-1 font-mono">EEE</span> or
              <span className="mx-1 rounded bg-white px-2 py-1 font-mono">RAE</span>.
            </p>

            <p>
              <span className="font-semibold">Department Name:</span> full department name such as
              <span className="mx-1 rounded bg-white px-2 py-1 font-mono">
                Electrical and Electronic Engineering
              </span>.
            </p>

            <p>
              <span className="font-semibold">Program Code:</span> one exact internal code for the final academic identity.
              Recommended structure:
              <span className="mx-1 rounded bg-white px-2 py-1 font-mono">BSC-EEE-REG-NEW</span>
              or
              <span className="mx-1 rounded bg-white px-2 py-1 font-mono">BSC-RAE-REG-OLD</span>.
            </p>

            <p>
              <span className="font-semibold">Program Title:</span> human-readable title such as
              <span className="mx-1 rounded bg-white px-2 py-1 font-mono">BSc EEE</span>.
            </p>

            <p>
              <span className="font-semibold">Program Type:</span> choose the general type such as
              REG, EVE, ACCELERATED, or OTHER.
            </p>

            <p>
              <span className="font-semibold">Study Shift:</span> choose REG, EVE, ACCELERATED, or OTHER
              according to the actual academic identity.
            </p>

            <p>
              <span className="font-semibold">Curriculum Version:</span> choose NEW, OLD, or OTHER.
            </p>

            <p>
              <span className="font-semibold">Student ID Suffix (ZZZ):</span> enter only the final 3-digit program identifier
              from student IDs of the structure
              <span className="mx-1 rounded bg-white px-2 py-1 font-mono">XXX-YYYY-ZZZ</span>.
              Example: in
              <span className="mx-1 rounded bg-white px-2 py-1 font-mono">232-0274-218</span>,
              the batch code is
              <span className="mx-1 rounded bg-white px-2 py-1 font-mono">232</span>
              and the suffix is
              <span className="mx-1 rounded bg-white px-2 py-1 font-mono">218</span>.
            </p>

            <p>
              <span className="font-semibold">Active:</span> keep checked for identities that should appear in dropdowns.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Department Code</label>
            <input
              value={departmentCode}
              onChange={(e) => setDepartmentCode(e.target.value.toUpperCase())}
              className="w-full rounded-2xl border px-3 py-2"
              placeholder="EEE"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Department Name</label>
            <input
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              className="w-full rounded-2xl border px-3 py-2"
              placeholder="Electrical and Electronic Engineering"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Program Code</label>
            <input
              value={programCode}
              onChange={(e) => setProgramCode(e.target.value.toUpperCase())}
              className="w-full rounded-2xl border px-3 py-2"
              placeholder="BSC-EEE-REG-NEW"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Program Title</label>
            <input
              value={programTitle}
              onChange={(e) => setProgramTitle(e.target.value)}
              className="w-full rounded-2xl border px-3 py-2"
              placeholder="BSc EEE"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Program Type</label>
            <select
              value={programType}
              onChange={(e) => setProgramType(e.target.value)}
              className="w-full rounded-2xl border px-3 py-2"
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
              className="w-full rounded-2xl border px-3 py-2"
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
              className="w-full rounded-2xl border px-3 py-2"
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
              className="w-full rounded-2xl border px-3 py-2"
              placeholder="218"
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
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Saving..." : "Save Academic Setup"}
            </button>
          </div>
        </form>

        {message ? (
          <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : null}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Configured Academic Identities</h2>

        <div className="mt-5 overflow-x-auto">
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
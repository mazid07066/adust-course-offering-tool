// src/app/admin/co-offering-decision-center/page-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin-layout";

type Candidate = {
  primaryId: number;
  secondaryId: number;
  primaryLabel: string;
  secondaryLabel: string;
  score: number;
  reason: string;
};

type Offering = {
  offeringId: number;
  programCode: string;
  programName: string;
  status: string;
  courseCount: number;
};

type CourseOption = {
  id: number;
  programCode: string;
  offeringStatus: string;
  courseCode: string;
  courseTitle: string;
  section: string;
  credit: number;
  primaryOfferedCourseId: number | null;
  linkedPrimaryLabel: string;
  slotCount: number;
  teacherCount: number;
  batchCodes: string[];
};

export default function Page() {
  const [termName, setTermName] = useState("SUMMER 2026");

  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const [primaryProgram, setPrimaryProgram] = useState("BSC-EEE-REG-NEW");
  const [secondaryProgram, setSecondaryProgram] = useState("BSC-RAE-REG-NEW");

  const [primaryCourseId, setPrimaryCourseId] = useState("");
  const [secondaryCourseId, setSecondaryCourseId] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const programOptions = useMemo(() => {
    return Array.from(new Set(offerings.map(o => o.programCode)));
  }, [offerings]);

  const primaryCourses = useMemo(() => {
    return courses.filter(c => c.programCode === primaryProgram);
  }, [courses, primaryProgram]);

  const secondaryCourses = useMemo(() => {
    return courses.filter(c => c.programCode === secondaryProgram);
  }, [courses, secondaryProgram]);

  const selectedSecondary = secondaryCourses.find(c => String(c.id) === secondaryCourseId);

  async function load() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/admin/co-offering-decision/candidates?termName=${termName}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json.error);

      setOfferings(json.diagnostics.matchedOfferings || []);
      setCourses(json.courses || []);
      setCandidates(json.candidates || []);

      if (!json.candidates.length) {
        setMessage("No auto candidates. Use manual linking.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function manualLink() {
    if (!primaryCourseId || !secondaryCourseId) {
      setError("Select both courses");
      return;
    }

    try {
      const res = await fetch("/api/admin/co-offering-decision/manual-link", {
        method: "POST",
        body: JSON.stringify({
          primaryOfferedCourseId: Number(primaryCourseId),
          secondaryOfferedCourseId: Number(secondaryCourseId),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setMessage("Linked successfully");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function unlinkCourse(id: number) {
    try {
      const res = await fetch("/api/admin/co-offering-decision/unlink", {
        method: "POST",
        body: JSON.stringify({ offeredCourseId: id }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setMessage("Unlinked successfully");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AdminLayout title="Co-offering Decision Center">
      <div className="space-y-6">

        {/* HEADER */}
        <div className="border p-6 rounded bg-white">
          <h2 className="text-xl font-bold">Co-offering Decision Center</h2>

          <div className="flex gap-3 mt-4">
            <input
              value={termName}
              onChange={(e) => setTermName(e.target.value.toUpperCase())}
              className="border px-3 py-2 rounded"
            />

            <button
              onClick={load}
              className="bg-black text-white px-4 py-2 rounded"
            >
              {loading ? "Loading..." : "Load"}
            </button>
          </div>
        </div>

        {/* STATUS */}
        {message && <div className="text-green-600">{message}</div>}
        {error && <div className="text-red-600">{error}</div>}

        {/* MANUAL LINK */}
        <div className="border p-6 rounded bg-white">
          <h3 className="font-bold mb-4">Manual Course Linking</h3>

          <div className="grid grid-cols-2 gap-4">

            {/* PRIMARY */}
            <div>
              <label>Primary Program</label>
              <select
                value={primaryProgram}
                onChange={(e) => {
                  setPrimaryProgram(e.target.value);
                  setPrimaryCourseId("");
                }}
                className="border p-2 w-full"
              >
                {programOptions.map(p => (
                  <option key={p}>{p}</option>
                ))}
              </select>

              <label className="mt-2 block">Primary Course</label>
              <select
                value={primaryCourseId}
                onChange={(e) => setPrimaryCourseId(e.target.value)}
                className="border p-2 w-full"
              >
                <option value="">Select</option>
                {primaryCourses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.courseCode} Sec-{c.section}
                  </option>
                ))}
              </select>
            </div>

            {/* SECONDARY */}
            <div>
              <label>Secondary Program</label>
              <select
                value={secondaryProgram}
                onChange={(e) => {
                  setSecondaryProgram(e.target.value);
                  setSecondaryCourseId("");
                }}
                className="border p-2 w-full"
              >
                {programOptions.map(p => (
                  <option key={p}>{p}</option>
                ))}
              </select>

              <label className="mt-2 block">Secondary Course</label>
              <select
                value={secondaryCourseId}
                onChange={(e) => setSecondaryCourseId(e.target.value)}
                className="border p-2 w-full"
              >
                <option value="">Select</option>
                {secondaryCourses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.courseCode} Sec-{c.section}
                    {c.primaryOfferedCourseId ? " (Linked)" : ""}
                  </option>
                ))}
              </select>

              {/* 🔴 UNLINK BUTTON */}
              {selectedSecondary?.primaryOfferedCourseId && (
                <button
                  onClick={() => unlinkCourse(selectedSecondary.id)}
                  className="bg-red-600 text-white px-3 py-2 rounded mt-3"
                >
                  Unlink This Course
                </button>
              )}
            </div>
          </div>

          <button
            onClick={manualLink}
            className="bg-green-600 text-white px-4 py-2 rounded mt-4"
          >
            Link Courses
          </button>
        </div>

        {/* AUTO CANDIDATES */}
        <div className="border p-6 rounded bg-white">
          <h3 className="font-bold mb-4">Auto Suggestions</h3>

          {candidates.map((c) => (
            <div key={`${c.primaryId}-${c.secondaryId}`} className="border p-3 mb-2">
              <div>{c.primaryLabel}</div>
              <div className="text-sm text-gray-500">
                ↔ {c.secondaryLabel}
              </div>
            </div>
          ))}
        </div>

      </div>
    </AdminLayout>
  );
}



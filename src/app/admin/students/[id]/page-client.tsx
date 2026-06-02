"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AdminLayout from "@/components/admin-layout";

type AnyRecord = Record<string, any>;

function contactValue(contacts: AnyRecord[], type: string) {
  return contacts.find((item) => item.contact_type === type)?.contact_value || "";
}

export default function StudentDetailPageClient() {
  const params = useParams();
  const id = String(params?.id || "");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [student, setStudent] = useState<AnyRecord | null>(null);
  const [enrollments, setEnrollments] = useState<AnyRecord[]>([]);
  const [statusHistory, setStatusHistory] = useState<AnyRecord[]>([]);
  const [advisorAssignments, setAdvisorAssignments] = useState<AnyRecord[]>([]);
  const [activeAdvisor, setActiveAdvisor] = useState<AnyRecord | null>(null);

  const [teachers, setTeachers] = useState<AnyRecord[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);

  const [statusForm, setStatusForm] = useState({
    new_status: "ACTIVE",
    reason: "",
  });

  const [advisorForm, setAdvisorForm] = useState({
    teacher_id: "",
    reason: "",
  });

  const [form, setForm] = useState<AnyRecord>({
    full_name: "",
    phone: "",
    email: "",
    date_of_birth: "",
    gender: "",
    blood_group: "",
    religion: "",
    nationality: "Bangladeshi",
    guardian_name: "",
    guardian_phone: "",
    present_address: "",
    permanent_address: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    remarks: "",
    father_name: "",
    father_phone: "",
    father_occupation: "",
    mother_name: "",
    mother_phone: "",
    mother_occupation: "",
    guardian_relation: "",
    guardian_email: "",
    guardian_address: "",
  });

  async function loadAll() {
    if (!id) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const [detailRes, optionsRes] = await Promise.all([
        fetch(`/api/admin/students/detail/${id}`, { cache: "no-store" }),
        fetch("/api/admin/students/detail/options", { cache: "no-store" }),
      ]);

      const detailJson = await detailRes.json();
      const optionsJson = await optionsRes.json();

      if (!detailRes.ok) {
        throw new Error(detailJson.error || "Failed to load student detail.");
      }

      if (!optionsRes.ok) {
        throw new Error(optionsJson.error || "Failed to load options.");
      }

      const s = detailJson.student || {};
      const c = detailJson.contacts || [];

      setStudent(s);
      setEnrollments(detailJson.enrollments || []);
      setStatusHistory(detailJson.statusHistory || []);
      setAdvisorAssignments(detailJson.advisorAssignments || []);
      setActiveAdvisor(detailJson.activeAdvisor || null);
      setTeachers(optionsJson.teachers || []);
      setStatuses(optionsJson.statuses || []);

      setStatusForm({
        new_status: s.current_status || "ACTIVE",
        reason: "",
      });

      setAdvisorForm({
        teacher_id: detailJson.activeAdvisor?.teacher_id
          ? String(detailJson.activeAdvisor.teacher_id)
          : "",
        reason: "",
      });

      setForm({
        full_name: s.full_name || "",
        phone: s.phone || "",
        email: s.email || "",
        date_of_birth: s.date_of_birth ? String(s.date_of_birth).slice(0, 10) : "",
        gender: s.gender || "",
        blood_group: s.blood_group || "",
        religion: s.religion || "",
        nationality: s.nationality || "Bangladeshi",
        guardian_name: s.guardian_name || "",
        guardian_phone: s.guardian_phone || "",
        present_address: s.present_address || "",
        permanent_address: s.permanent_address || "",
        emergency_contact_name: s.emergency_contact_name || "",
        emergency_contact_phone: s.emergency_contact_phone || "",
        remarks: s.remarks || "",
        father_name: contactValue(c, "FATHER_NAME"),
        father_phone: contactValue(c, "FATHER_PHONE"),
        father_occupation: contactValue(c, "FATHER_OCCUPATION"),
        mother_name: contactValue(c, "MOTHER_NAME"),
        mother_phone: contactValue(c, "MOTHER_PHONE"),
        mother_occupation: contactValue(c, "MOTHER_OCCUPATION"),
        guardian_relation: contactValue(c, "GUARDIAN_RELATION"),
        guardian_email: contactValue(c, "GUARDIAN_EMAIL"),
        guardian_address: contactValue(c, "GUARDIAN_ADDRESS"),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load student detail.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [id]);

  function updateForm(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveProfile() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/admin/students/detail/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to save student profile.");
      }

      setMessage(json.message || "Student profile saved.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save student profile.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/admin/students/detail/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(statusForm),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to update status.");
      }

      setMessage(json.message || "Student status updated.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setSaving(false);
    }
  }

  async function updateAdvisor() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/admin/students/detail/${id}/advisor`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(advisorForm),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to update advisor.");
      }

      setMessage(json.message || "Advisor updated.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update advisor.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !student) {
    return (
      <AdminLayout title="Student Detail">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          Loading student detail...
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Student Detail Enhancement">
      <div className="space-y-6 print:space-y-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              S1-C Student Core
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              {student?.student_id || "-"} — {student?.full_name || "-"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Current Status:{" "}
              <span className="font-semibold">{student?.current_status || "ACTIVE"}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-3 print:hidden">
            <Link
              href="/admin/students"
              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Back to Students
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Print Profile
            </button>
          </div>
        </div>

        {(error || message) && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">
                Personal Information
              </h3>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Input label="Full Name" value={form.full_name} onChange={(v) => updateForm("full_name", v)} />
                <Input label="Phone" value={form.phone} onChange={(v) => updateForm("phone", v)} />
                <Input label="Email" value={form.email} onChange={(v) => updateForm("email", v)} />
                <Input label="Date of Birth" type="date" value={form.date_of_birth} onChange={(v) => updateForm("date_of_birth", v)} />
                <Select label="Gender" value={form.gender} onChange={(v) => updateForm("gender", v)} options={["", "Male", "Female", "Other"]} />
                <Input label="Blood Group" value={form.blood_group} onChange={(v) => updateForm("blood_group", v)} />
                <Input label="Religion" value={form.religion} onChange={(v) => updateForm("religion", v)} />
                <Input label="Nationality" value={form.nationality} onChange={(v) => updateForm("nationality", v)} />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Textarea label="Present Address" value={form.present_address} onChange={(v) => updateForm("present_address", v)} />
                <Textarea label="Permanent Address" value={form.permanent_address} onChange={(v) => updateForm("permanent_address", v)} />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Input label="Emergency Contact Name" value={form.emergency_contact_name} onChange={(v) => updateForm("emergency_contact_name", v)} />
                <Input label="Emergency Contact Phone" value={form.emergency_contact_phone} onChange={(v) => updateForm("emergency_contact_phone", v)} />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">
                Guardian and Contact Information
              </h3>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Input label="Guardian Name" value={form.guardian_name} onChange={(v) => updateForm("guardian_name", v)} />
                <Input label="Guardian Phone" value={form.guardian_phone} onChange={(v) => updateForm("guardian_phone", v)} />
                <Input label="Father Name" value={form.father_name} onChange={(v) => updateForm("father_name", v)} />
                <Input label="Father Phone" value={form.father_phone} onChange={(v) => updateForm("father_phone", v)} />
                <Input label="Father Occupation" value={form.father_occupation} onChange={(v) => updateForm("father_occupation", v)} />
                <Input label="Mother Name" value={form.mother_name} onChange={(v) => updateForm("mother_name", v)} />
                <Input label="Mother Phone" value={form.mother_phone} onChange={(v) => updateForm("mother_phone", v)} />
                <Input label="Mother Occupation" value={form.mother_occupation} onChange={(v) => updateForm("mother_occupation", v)} />
                <Input label="Guardian Relation" value={form.guardian_relation} onChange={(v) => updateForm("guardian_relation", v)} />
                <Input label="Guardian Email" value={form.guardian_email} onChange={(v) => updateForm("guardian_email", v)} />
              </div>

              <div className="mt-4">
                <Textarea label="Guardian Address" value={form.guardian_address} onChange={(v) => updateForm("guardian_address", v)} />
              </div>

              <div className="mt-4">
                <Textarea label="Remarks" value={form.remarks} onChange={(v) => updateForm("remarks", v)} />
              </div>

              <div className="mt-5 print:hidden">
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={saving}
                  className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Student Detail"}
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">
                Enrollment Timeline
              </h3>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b px-3 py-2 text-left">Program</th>
                      <th className="border-b px-3 py-2 text-left">Department</th>
                      <th className="border-b px-3 py-2 text-left">Batch</th>
                      <th className="border-b px-3 py-2 text-left">Curriculum</th>
                      <th className="border-b px-3 py-2 text-left">Admission Semester</th>
                      <th className="border-b px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((item) => (
                      <tr key={item.id}>
                        <td className="border-b px-3 py-2">
                          {item.program?.short_name || "-"} — {item.program?.name || "-"}
                        </td>
                        <td className="border-b px-3 py-2">
                          {item.program?.departments?.short_name || "-"}
                        </td>
                        <td className="border-b px-3 py-2">{item.batches?.batch_code || "-"}</td>
                        <td className="border-b px-3 py-2">{item.curriculum_key || "-"}</td>
                        <td className="border-b px-3 py-2">{item.admission_semester || "-"}</td>
                        <td className="border-b px-3 py-2">{item.enrollment_status || "-"}</td>
                      </tr>
                    ))}

                    {enrollments.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                          No enrollment records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
              <h3 className="text-lg font-semibold text-slate-900">
                Advisor Assignment
              </h3>

              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                Current Advisor:{" "}
                <span className="font-semibold">
                  {activeAdvisor?.teachers
                    ? `${activeAdvisor.teachers.teacher_code} — ${activeAdvisor.teachers.full_name}`
                    : "Not assigned"}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  Advisor
                </label>
                <select
                  value={advisorForm.teacher_id}
                  onChange={(e) =>
                    setAdvisorForm((prev) => ({
                      ...prev,
                      teacher_id: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border px-3 py-2"
                >
                  <option value="">Select Advisor</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.teacher_code} — {t.full_name}
                    </option>
                  ))}
                </select>

                <Textarea
                  label="Reason / Note"
                  value={advisorForm.reason}
                  onChange={(v) =>
                    setAdvisorForm((prev) => ({ ...prev, reason: v }))
                  }
                />

                <button
                  type="button"
                  onClick={updateAdvisor}
                  disabled={saving || !advisorForm.teacher_id}
                  className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  Update Advisor
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
              <h3 className="text-lg font-semibold text-slate-900">
                Student Status Workflow
              </h3>

              <div className="mt-4 space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  New Status
                </label>
                <select
                  value={statusForm.new_status}
                  onChange={(e) =>
                    setStatusForm((prev) => ({
                      ...prev,
                      new_status: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border px-3 py-2"
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>

                <Textarea
                  label="Reason"
                  value={statusForm.reason}
                  onChange={(v) =>
                    setStatusForm((prev) => ({ ...prev, reason: v }))
                  }
                />

                <button
                  type="button"
                  onClick={updateStatus}
                  disabled={saving}
                  className="w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  Update Status
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">
                Portal Readiness
              </h3>

              <div className="mt-4 space-y-2 text-sm text-slate-700">
                <p>
                  Portal User Link:{" "}
                  <span className="font-semibold">
                    {student?.portal_user_id
                      ? `Linked user #${student.portal_user_id}`
                      : "Not linked yet"}
                  </span>
                </p>

                <Link
                  href={`/student/dashboard?studentId=${encodeURIComponent(student?.student_id || "")}`}
                  className="inline-block rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 print:hidden"
                >
                  Open Dashboard Preview
                </Link>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">
                Status History
              </h3>

              <div className="mt-4 space-y-3 text-sm">
                {statusHistory.map((item) => (
                  <div key={item.id} className="rounded-xl border bg-slate-50 p-3">
                    <div className="font-medium">
                      {item.old_status || "-"} → {item.new_status}
                    </div>
                    <div className="text-slate-600">{item.note || "No note provided"}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {String(item.changed_at || "").slice(0, 19)}
                    </div>
                  </div>
                ))}

                {statusHistory.length === 0 && (
                  <p className="text-slate-500">No status history yet.</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">
                Advisor Assignment History
              </h3>

              <div className="mt-4 space-y-3 text-sm">
                {advisorAssignments.map((item) => (
                  <div key={item.id} className="rounded-xl border bg-slate-50 p-3">
                    <div className="font-medium">
                      {item.teachers?.teacher_code || "-"} —{" "}
                      {item.teachers?.full_name || "-"}
                    </div>
                    <div className="text-slate-600">
                      {item.remarks || "No note provided"}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      Active: {item.is_active ? "Yes" : "No"} |{" "}
                      {String(item.assigned_at || "").slice(0, 19)}
                    </div>
                  </div>
                ))}

                {advisorAssignments.length === 0 && (
                  <p className="text-slate-500">No advisor assignment history yet.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border px-3 py-2"
      />
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full rounded-xl border px-3 py-2"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border px-3 py-2"
      >
        {options.map((item) => (
          <option key={item || "empty"} value={item}>
            {item || "Select"}
          </option>
        ))}
      </select>
    </label>
  );
}

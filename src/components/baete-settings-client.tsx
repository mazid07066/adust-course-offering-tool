"use client";

import { FormEvent, useEffect, useState } from "react";

type Committee = {
  id: number;
  committee_code: string;
  committee_name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
};

type Module = {
  id: number;
  module_code: string;
  module_title: string;
};

type TaskGroup = {
  id: number;
  module_id: number;
  module_code: string;
  module_title: string;
  group_code: string;
  group_title: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
};

type Criterion = {
  id: number;
  criterion_code: string;
  title: string;
  description: string | null;
  weight: number;
  minimum_acceptable_score: number;
  display_order: number;
  is_active: boolean;
};

type ActiveTab = "committees" | "groups" | "criteria";

export default function BaeteSettingsClient() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("committees");
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [committeeForm, setCommitteeForm] = useState({
    committee_code: "",
    committee_name: "",
    description: "",
    display_order: "0",
  });

  const [groupForm, setGroupForm] = useState({
    module_id: "",
    group_code: "",
    group_title: "",
    description: "",
    display_order: "0",
  });

  const [criterionForm, setCriterionForm] = useState({
    criterion_code: "",
    title: "",
    description: "",
    weight: "0",
    minimum_acceptable_score: "3.6",
    display_order: "0",
  });

  async function loadCommittees() {
    const res = await fetch("/api/admin/accreditation/committees", {
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to load committees.");
    setCommittees(json.committees || []);
  }

  async function loadGroups() {
    const res = await fetch("/api/admin/accreditation/task-groups", {
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to load task groups.");
    setGroups(json.groups || []);
    setModules(json.modules || []);

    if (!groupForm.module_id && json.modules?.[0]?.id) {
      setGroupForm((current) => ({
        ...current,
        module_id: String(json.modules[0].id),
      }));
    }
  }

  async function loadCriteria() {
    const res = await fetch("/api/admin/accreditation/criteria", {
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to load criteria.");
    setCriteria(json.criteria || []);
  }

  async function loadAll() {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      await Promise.all([loadCommittees(), loadGroups(), loadCriteria()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function submitCommittee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/admin/accreditation/committees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(committeeForm),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create committee.");

      setCommitteeForm({
        committee_code: "",
        committee_name: "",
        description: "",
        display_order: "0",
      });

      setMessage("Committee created successfully.");
      await loadCommittees();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create committee.");
    }
  }

  async function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/admin/accreditation/task-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(groupForm),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create task group.");

      setGroupForm((current) => ({
        ...current,
        group_code: "",
        group_title: "",
        description: "",
        display_order: "0",
      }));

      setMessage("Task group created successfully.");
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task group.");
    }
  }

  async function submitCriterion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/admin/accreditation/criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(criterionForm),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create criterion.");

      setCriterionForm({
        criterion_code: "",
        title: "",
        description: "",
        weight: "0",
        minimum_acceptable_score: "3.6",
        display_order: "0",
      });

      setMessage("Criterion created successfully.");
      await loadCriteria();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create criterion.");
    }
  }

  async function archiveRecord(type: ActiveTab, id: number) {
    setMessage("");
    setError("");

    const url =
      type === "committees"
        ? `/api/admin/accreditation/committees/${id}`
        : type === "groups"
          ? `/api/admin/accreditation/task-groups/${id}`
          : `/api/admin/accreditation/criteria/${id}`;

    try {
      const res = await fetch(url, { method: "DELETE" });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Archive failed.");

      setMessage(json.message || "Archived successfully.");

      if (type === "committees") await loadCommittees();
      if (type === "groups") await loadGroups();
      if (type === "criteria") await loadCriteria();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed.");
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm";
  const labelClass =
    "mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-serif text-3xl text-slate-950">
              BAETE Configuration Center
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Configure committees, task groups, and accreditation criteria used
              by the dynamic BAETE workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className="w-fit rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {[
            ["committees", "Committees"],
            ["groups", "Task Groups"],
            ["criteria", "Criteria"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key as ActiveTab)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                activeTab === key
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {activeTab === "committees" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-950">Create Committee</h3>

          <form onSubmit={submitCommittee} className="mt-4 grid gap-4 lg:grid-cols-4">
            <label>
              <span className={labelClass}>Code</span>
              <input
                value={committeeForm.committee_code}
                onChange={(event) =>
                  setCommitteeForm((current) => ({
                    ...current,
                    committee_code: event.target.value,
                  }))
                }
                placeholder="ASC"
                className={inputClass}
              />
            </label>

            <label>
              <span className={labelClass}>Name</span>
              <input
                value={committeeForm.committee_name}
                onChange={(event) =>
                  setCommitteeForm((current) => ({
                    ...current,
                    committee_name: event.target.value,
                  }))
                }
                placeholder="Accreditation Steering Committee"
                className={inputClass}
              />
            </label>

            <label>
              <span className={labelClass}>Order</span>
              <input
                type="number"
                value={committeeForm.display_order}
                onChange={(event) =>
                  setCommitteeForm((current) => ({
                    ...current,
                    display_order: event.target.value,
                  }))
                }
                className={inputClass}
              />
            </label>

            <label className="lg:col-span-4">
              <span className={labelClass}>Description</span>
              <textarea
                value={committeeForm.description}
                onChange={(event) =>
                  setCommitteeForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className={`${inputClass} h-24`}
              />
            </label>

            <div className="lg:col-span-4">
              <button className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">
                Create Committee
              </button>
            </div>
          </form>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-950 text-white">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Order</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {committees.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-bold">{item.committee_code}</td>
                    <td className="px-4 py-3">{item.committee_name}</td>
                    <td className="px-4 py-3">
                      {item.is_active ? "Active" : "Archived"}
                    </td>
                    <td className="px-4 py-3">{item.display_order}</td>
                    <td className="px-4 py-3">
                      {item.is_active ? (
                        <button
                          type="button"
                          onClick={() => archiveRecord("committees", item.id)}
                          className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700"
                        >
                          Archive
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Archived</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === "groups" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-950">Create Task Group</h3>

          <form onSubmit={submitGroup} className="mt-4 grid gap-4 lg:grid-cols-4">
            <label>
              <span className={labelClass}>Module</span>
              <select
                value={groupForm.module_id}
                onChange={(event) =>
                  setGroupForm((current) => ({
                    ...current,
                    module_id: event.target.value,
                  }))
                }
                className={inputClass}
              >
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.module_code} — {module.module_title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className={labelClass}>Group Code</span>
              <input
                value={groupForm.group_code}
                onChange={(event) =>
                  setGroupForm((current) => ({
                    ...current,
                    group_code: event.target.value,
                  }))
                }
                placeholder="DOC_CQI"
                className={inputClass}
              />
            </label>

            <label>
              <span className={labelClass}>Group Title</span>
              <input
                value={groupForm.group_title}
                onChange={(event) =>
                  setGroupForm((current) => ({
                    ...current,
                    group_title: event.target.value,
                  }))
                }
                placeholder="CQI Evidence Documents"
                className={inputClass}
              />
            </label>

            <label>
              <span className={labelClass}>Order</span>
              <input
                type="number"
                value={groupForm.display_order}
                onChange={(event) =>
                  setGroupForm((current) => ({
                    ...current,
                    display_order: event.target.value,
                  }))
                }
                className={inputClass}
              />
            </label>

            <label className="lg:col-span-4">
              <span className={labelClass}>Description</span>
              <textarea
                value={groupForm.description}
                onChange={(event) =>
                  setGroupForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className={`${inputClass} h-24`}
              />
            </label>

            <div className="lg:col-span-4">
              <button className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">
                Create Task Group
              </button>
            </div>
          </form>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-950 text-white">
                <tr>
                  <th className="px-4 py-3 text-left">Module</th>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="px-4 py-3">{item.module_title}</td>
                    <td className="px-4 py-3 font-bold">{item.group_code}</td>
                    <td className="px-4 py-3">{item.group_title}</td>
                    <td className="px-4 py-3">
                      {item.is_active ? "Active" : "Archived"}
                    </td>
                    <td className="px-4 py-3">
                      {item.is_active ? (
                        <button
                          type="button"
                          onClick={() => archiveRecord("groups", item.id)}
                          className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700"
                        >
                          Archive
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Archived</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === "criteria" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-950">Create Criterion</h3>

          <form onSubmit={submitCriterion} className="mt-4 grid gap-4 lg:grid-cols-5">
            <label>
              <span className={labelClass}>Code</span>
              <input
                value={criterionForm.criterion_code}
                onChange={(event) =>
                  setCriterionForm((current) => ({
                    ...current,
                    criterion_code: event.target.value,
                  }))
                }
                placeholder="C7"
                className={inputClass}
              />
            </label>

            <label className="lg:col-span-2">
              <span className={labelClass}>Title</span>
              <input
                value={criterionForm.title}
                onChange={(event) =>
                  setCriterionForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Stakeholder Engagement"
                className={inputClass}
              />
            </label>

            <label>
              <span className={labelClass}>Weight</span>
              <input
                type="number"
                step="0.1"
                value={criterionForm.weight}
                onChange={(event) =>
                  setCriterionForm((current) => ({
                    ...current,
                    weight: event.target.value,
                  }))
                }
                className={inputClass}
              />
            </label>

            <label>
              <span className={labelClass}>Min Score</span>
              <input
                type="number"
                step="0.1"
                value={criterionForm.minimum_acceptable_score}
                onChange={(event) =>
                  setCriterionForm((current) => ({
                    ...current,
                    minimum_acceptable_score: event.target.value,
                  }))
                }
                className={inputClass}
              />
            </label>

            <label>
              <span className={labelClass}>Order</span>
              <input
                type="number"
                value={criterionForm.display_order}
                onChange={(event) =>
                  setCriterionForm((current) => ({
                    ...current,
                    display_order: event.target.value,
                  }))
                }
                className={inputClass}
              />
            </label>

            <label className="lg:col-span-5">
              <span className={labelClass}>Description</span>
              <textarea
                value={criterionForm.description}
                onChange={(event) =>
                  setCriterionForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className={`${inputClass} h-24`}
              />
            </label>

            <div className="lg:col-span-5">
              <button className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">
                Create Criterion
              </button>
            </div>
          </form>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-950 text-white">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Weight</th>
                  <th className="px-4 py-3 text-left">Min Score</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {criteria.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-bold">{item.criterion_code}</td>
                    <td className="px-4 py-3">{item.title}</td>
                    <td className="px-4 py-3">{item.weight}</td>
                    <td className="px-4 py-3">{item.minimum_acceptable_score}</td>
                    <td className="px-4 py-3">
                      {item.is_active ? "Active" : "Archived"}
                    </td>
                    <td className="px-4 py-3">
                      {item.is_active ? (
                        <button
                          type="button"
                          onClick={() => archiveRecord("criteria", item.id)}
                          className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700"
                        >
                          Archive
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Archived</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

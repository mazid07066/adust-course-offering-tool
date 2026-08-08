"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type OfferingStatus =
  | "ACTIVE_FOR_OFFERING"
  | "NO_OFFERING_PASSING_OUT"
  | "NO_OFFERING_NO_STUDENTS"
  | "NO_OFFERING_PROGRAM_DECISION"
  | "NO_OFFERING_OTHER";

type BatchRow = {
  id: number;
  batchCode: string;
  admissionTerm: string | null;
  programId: number;
  programCode: string;
  programName: string;
  departmentCode: string;
  departmentName: string;
  status: OfferingStatus;
  reason: string | null;
  updatedAt: string | null;
};

type ApiResponse = {
  ok: boolean;

  error?: string;

  term?: {
    id: number;
    name: string;
    isCurrent: boolean;
  };

  batches?: BatchRow[];
};

const STATUS_OPTIONS: {
  value: OfferingStatus;
  label: string;
}[] = [
  {
    value:
      "ACTIVE_FOR_OFFERING",
    label:
      "Active for Offering",
  },
  {
    value:
      "NO_OFFERING_PASSING_OUT",
    label:
      "No Offering — Passing Out / Graduating",
  },
  {
    value:
      "NO_OFFERING_NO_STUDENTS",
    label:
      "No Offering — No Students",
  },
  {
    value:
      "NO_OFFERING_PROGRAM_DECISION",
    label:
      "No Offering — Program Decision",
  },
  {
    value:
      "NO_OFFERING_OTHER",
    label:
      "No Offering — Other",
  },
];

function statusLabel(
  status: OfferingStatus
) {
  return (
    STATUS_OPTIONS.find(
      (item) =>
        item.value ===
        status
    )?.label ||
    status
  );
}

export default function BatchOfferingStatusPageClient() {
  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    savingBatchId,
    setSavingBatchId,
  ] = useState<
    number | null
  >(null);

  const [
    error,
    setError,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    termName,
    setTermName,
  ] = useState("");

  const [
    batches,
    setBatches,
  ] = useState<
    BatchRow[]
  >([]);

  const [
    searchText,
    setSearchText,
  ] = useState("");

  const loadData =
    useCallback(
      async () => {
        setLoading(
          true
        );

        setError("");

        try {
          const response =
            await fetch(
              "/api/admin/batch-offering-status",
              {
                cache:
                  "no-store",
              }
            );

          const data =
            (await response.json()) as ApiResponse;

          if (
            !response.ok ||
            !data.ok
          ) {
            throw new Error(
              data.error ||
                "Failed to load semester batch statuses."
            );
          }

          setTermName(
            data.term?.name ||
              ""
          );

          setBatches(
            data.batches ||
              []
          );
        } catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load semester batch statuses."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      []
    );

  useEffect(() => {
    void loadData();
  }, [
    loadData,
  ]);

  const visibleBatches =
    useMemo(
      () => {
        const clean =
          searchText
            .trim()
            .toLowerCase();

        if (!clean) {
          return batches;
        }

        return batches.filter(
          (batch) =>
            [
              batch.batchCode,
              batch.programCode,
              batch.programName,
              batch.departmentCode,
              batch.departmentName,
              batch.status,
              batch.reason || "",
            ]
              .join(" ")
              .toLowerCase()
              .includes(
                clean
              )
        );
      },
      [
        batches,
        searchText,
      ]
    );

  function updateLocalBatch(
    batchId: number,
    updates: Partial<BatchRow>
  ) {
    setBatches(
      (current) =>
        current.map(
          (batch) =>
            batch.id ===
            batchId
              ? {
                  ...batch,
                  ...updates,
                }
              : batch
        )
    );
  }

  async function saveBatch(
    batch: BatchRow
  ) {
    setSavingBatchId(
      batch.id
    );

    setError("");
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/batch-offering-status",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                batchId:
                  batch.id,

                termName,

                status:
                  batch.status,

                reason:
                  batch.reason ||
                  "",
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.ok
      ) {
        throw new Error(
          data.error ||
            "Failed to save semester batch status."
        );
      }

      setMessage(
        data.message ||
          "Semester batch status saved."
      );

      await loadData();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save semester batch status."
      );
    } finally {
      setSavingBatchId(
        null
      );
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Semester Batch Offering Status
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Control whether an
          individual batch should
          participate in course
          offering preparation for
          the current academic
          semester.
        </p>

        <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <strong>
            Current semester:
          </strong>{" "}
          {termName ||
            "Loading..."}

          <p className="mt-2">
            This does not deactivate
            the batch and does not
            delete transcripts,
            registrations, previous
            offerings, students, or
            archive history.
          </p>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {message}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold">
              Batch Decisions
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Decisions apply only
              to{" "}
              <strong>
                {termName ||
                  "the current semester"}
              </strong>
              .
            </p>
          </div>

          <input
            type="text"
            value={
              searchText
            }
            onChange={(
              event
            ) =>
              setSearchText(
                event.target
                  .value
              )
            }
            placeholder="Search program or batch..."
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm md:w-80"
          />
        </div>

        {loading ? (
          <div className="mt-6 text-sm text-slate-600">
            Loading batches...
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-600">
                  <th className="px-3 py-3">
                    Program
                  </th>

                  <th className="px-3 py-3">
                    Batch
                  </th>

                  <th className="px-3 py-3">
                    Admission
                  </th>

                  <th className="px-3 py-3">
                    Semester Status
                  </th>

                  <th className="px-3 py-3">
                    Reason / Note
                  </th>

                  <th className="px-3 py-3">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {visibleBatches.map(
                  (batch) => (
                    <tr
                      key={
                        batch.id
                      }
                      className="border-b align-top"
                    >
                      <td className="px-3 py-4">
                        <div className="font-semibold text-slate-900">
                          {
                            batch.programCode
                          }
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {
                            batch.programName
                          }
                        </div>
                      </td>

                      <td className="px-3 py-4 font-bold">
                        {
                          batch.batchCode
                        }
                      </td>

                      <td className="px-3 py-4">
                        {
                          batch.admissionTerm ||
                          "-"
                        }
                      </td>

                      <td className="px-3 py-4">
                        <select
                          value={
                            batch.status
                          }
                          onChange={(
                            event
                          ) =>
                            updateLocalBatch(
                              batch.id,
                              {
                                status:
                                  event
                                    .target
                                    .value as OfferingStatus,
                              }
                            )
                          }
                          className="min-w-72 rounded-xl border border-slate-300 px-3 py-2"
                        >
                          {STATUS_OPTIONS.map(
                            (
                              option
                            ) => (
                              <option
                                key={
                                  option.value
                                }
                                value={
                                  option.value
                                }
                              >
                                {
                                  option.label
                                }
                              </option>
                            )
                          )}
                        </select>

                        <div className="mt-2 text-xs font-medium text-slate-500">
                          {statusLabel(
                            batch.status
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-4">
                        <input
                          type="text"
                          value={
                            batch.reason ||
                            ""
                          }
                          onChange={(
                            event
                          ) =>
                            updateLocalBatch(
                              batch.id,
                              {
                                reason:
                                  event
                                    .target
                                    .value,
                              }
                            )
                          }
                          placeholder="Optional note"
                          className="min-w-72 rounded-xl border border-slate-300 px-3 py-2"
                        />
                      </td>

                      <td className="px-3 py-4">
                        <button
                          type="button"
                          disabled={
                            savingBatchId ===
                            batch.id
                          }
                          onClick={() =>
                            void saveBatch(
                              batch
                            )
                          }
                          className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {savingBatchId ===
                          batch.id
                            ? "Saving..."
                            : "Save"}
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>

            {visibleBatches.length ===
            0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                No matching batches
                found.
              </div>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type ProgramOption = {
  id: number;
  programCode: string;
  programName: string;
  departmentCode: string;
  departmentName: string;
  displayLabel: string;
};

type CandidateSlot = {
  id: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotType: string;
  roomId: number | null;
  roomCode: string;
  roomType: string;
};

type CandidateFaculty = {
  id: number;
  teacherCode: string;
  fullName: string;
  assignedCredit: number;
  loadType: string;
};

type Candidate = {
  id: number;
  offeringId: number;
  section: string;
  programCode: string;
  programName: string;
  courseCode: string;
  courseTitle: string;
  credit: number;
  batchCodes: string[];
  slots: CandidateSlot[];
  faculty: CandidateFaculty[];
  scheduleText: string;
  facultyText: string;
  slotCount: number;
  teacherCount: number;
  isSecondary: boolean;
  primaryOfferedCourseId: number | null;
};

type OptionsResponse = {
  ok?: boolean;
  error?: string;
  primarySections?: Candidate[];
};

type Props = {
  termName: string;
  currentProgramCode: string;
  courseCode: string;
  courseTitle: string;
  credit: number;
  programs: ProgramOption[];
  value: string;
  onChange: (value: string) => void;
};

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export default function PrecreateManualCoOffer({
  termName,
  currentProgramCode,
  courseCode,
  courseTitle,
  credit,
  programs,
  value,
  onChange,
}: Props) {
  const [enabled, setEnabled] =
    useState(false);

  const [
    primaryProgramCode,
    setPrimaryProgramCode,
  ] = useState("");

  const [
    candidates,
    setCandidates,
  ] = useState<Candidate[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const otherPrograms = useMemo(
    () =>
      programs.filter(
        (program) =>
          program.programCode !==
          currentProgramCode
      ),
    [
      programs,
      currentProgramCode,
    ]
  );

  const selectedPrimary =
    useMemo(
      () =>
        candidates.find(
          (candidate) =>
            String(candidate.id) ===
            value
        ) || null,
      [
        candidates,
        value,
      ]
    );

  useEffect(() => {
    setEnabled(false);
    setPrimaryProgramCode("");
    setCandidates([]);
    setError("");
    onChange("");
  }, [
    termName,
    currentProgramCode,
    courseCode,
    courseTitle,
    credit,
    onChange,
  ]);

  function changeEnabled(
    nextEnabled: boolean
  ) {
    setEnabled(nextEnabled);
    setPrimaryProgramCode("");
    setCandidates([]);
    setError("");
    onChange("");
  }

  async function loadCandidates(
    nextProgramCode: string
  ) {
    setPrimaryProgramCode(
      nextProgramCode
    );

    setCandidates([]);
    setError("");
    onChange("");

    if (!nextProgramCode) {
      return;
    }

    setLoading(true);

    try {
      const params =
        new URLSearchParams({
          termName,
          primaryProgramCode:
            nextProgramCode,
          secondaryProgramCode:
            currentProgramCode,
        });

      const response =
        await fetch(
          `/api/co-offering/options?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

      const json:
        OptionsResponse =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json.error ||
            "Failed to load existing offered courses."
        );
      }

      const currentTitle =
        normalize(courseTitle);

      const eligible =
        (
          json.primarySections || []
        )
          .filter(
            (candidate) =>
              !candidate.isSecondary
          )
          .sort((a, b) => {
            const aExact =
              normalize(
                a.courseTitle
              ) === currentTitle
                ? 1
                : 0;

            const bExact =
              normalize(
                b.courseTitle
              ) === currentTitle
                ? 1
                : 0;

            if (
              aExact !== bExact
            ) {
              return (
                bExact - aExact
              );
            }

            return `${a.courseCode}-${a.section}`.localeCompare(
              `${b.courseCode}-${b.section}`
            );
          });

      setCandidates(eligible);

      const exactTitleMatch =
        eligible.find(
          (candidate) =>
            normalize(
              candidate.courseTitle
            ) === currentTitle
        );

      if (exactTitleMatch) {
        onChange(
          String(
            exactTitleMatch.id
          )
        );
      } else if (
        eligible.length === 1
      ) {
        onChange(
          String(
            eligible[0].id
          )
        );
      }
    } catch (err) {
      setCandidates([]);
      onChange("");

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load existing offered courses."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) =>
            changeEnabled(
              event.target.checked
            )
          }
          className="h-4 w-4"
        />

        <span className="text-sm font-bold text-indigo-950">
          Co-offer with existing offered course
        </span>
      </label>

      <p className="mt-1 text-xs leading-5 text-indigo-800">
        When enabled, this course keeps
        its own program, course code and
        batch identity. Schedule, room
        and faculty are controlled by the
        selected primary course.
      </p>

      {enabled ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Existing Program
            </label>

            <select
              value={
                primaryProgramCode
              }
              onChange={(event) =>
                void loadCandidates(
                  event.target.value
                )
              }
              disabled={loading}
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
            >
              <option value="">
                Select existing program
              </option>

              {otherPrograms.map(
                (program) => (
                  <option
                    key={`${program.id}-${program.programCode}`}
                    value={
                      program.programCode
                    }
                  >
                    {
                      program.displayLabel
                    }
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Primary Offered Course
            </label>

            <select
              value={value}
              onChange={(event) =>
                onChange(
                  event.target.value
                )
              }
              disabled={
                loading ||
                !primaryProgramCode ||
                candidates.length === 0
              }
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
            >
              <option value="">
                {loading
                  ? "Loading..."
                  : "Select existing offered course"}
              </option>

              {candidates.map(
                (candidate) => (
                  <option
                    key={
                      candidate.id
                    }
                    value={
                      candidate.id
                    }
                  >
                    {
                      candidate.courseCode
                    }{" "}
                    |{" "}
                    {
                      candidate.courseTitle
                    }{" "}
                    | {candidate.credit} cr | Sec-
                    {
                      candidate.section
                    }{" "}
                    | Batch{" "}
                    {candidate.batchCodes.join(
                      ", "
                    ) || "-"}
                  </option>
                )
              )}
            </select>
          </div>

          {primaryProgramCode &&
          !loading &&
          candidates.length === 0 ? (
            <div className="lg:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No eligible primary offered course was found in this program.
            </div>
          ) : null}

          {error ? (
            <div className="lg:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          ) : null}

          {selectedPrimary ? (
            <div className="lg:col-span-2 rounded-2xl border border-emerald-300 bg-emerald-50 p-4">
              <div className="text-sm font-bold text-emerald-950">
                Controlled by Primary Course
              </div>

              <div className="mt-2 text-sm font-semibold text-slate-900">
                {
                  selectedPrimary.courseCode
                }{" "}
                -{" "}
                {
                  selectedPrimary.courseTitle
                }{" "}
                | Sec-
                {
                  selectedPrimary.section
                }
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-emerald-200 bg-white p-3">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Inherited Faculty
                  </div>

                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {
                      selectedPrimary.facultyText
                    }
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-white p-3">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Primary Batches
                  </div>

                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {selectedPrimary.batchCodes.join(
                      ", "
                    ) || "-"}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Inherited Schedule and Room
                </div>

                {selectedPrimary.slots.length >
                0 ? (
                  <div className="mt-2 space-y-2">
                    {selectedPrimary.slots.map(
                      (slot) => (
                        <div
                          key={
                            slot.id
                          }
                          className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800"
                        >
                          <span className="font-semibold">
                            {
                              slot.dayOfWeek
                            }
                          </span>
                          {" | "}
                          {
                            slot.startTime
                          }
                          -
                          {
                            slot.endTime
                          }
                          {" | "}
                          {
                            slot.roomCode
                          }
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="mt-1 text-sm text-amber-700">
                    Primary course has no
                    scheduled slot yet.
                  </div>
                )}
              </div>

              <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
                You do not need to choose
                another faculty, room,
                class day, start time, end
                time, or load type for the
                secondary course.
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

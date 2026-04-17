"use client";

import {
  AcademicCatalogProgramOption,
} from "@/hooks/use-academic-catalog-programs";
import { ProgramBatchOption } from "@/hooks/use-program-batches";

type Props = {
  programs: AcademicCatalogProgramOption[];
  programCode: string;
  setProgramCode: (value: string) => void;
  loadingPrograms?: boolean;
  batches?: ProgramBatchOption[];
  batchCode?: string;
  setBatchCode?: (value: string) => void;
  loadingBatches?: boolean;
  showBatch?: boolean;
};

export default function ProgramBatchSelector({
  programs,
  programCode,
  setProgramCode,
  loadingPrograms = false,
  batches = [],
  batchCode = "",
  setBatchCode,
  loadingBatches = false,
  showBatch = true,
}: Props) {
  const selectedProgram =
    programs.find((item) => item.programCode === programCode) || null;

  return (
    <div className="space-y-4">
      <div className={`grid gap-4 ${showBatch ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Program / Curriculum
          </label>
          <select
            value={programCode}
            onChange={(e) => setProgramCode(e.target.value)}
            disabled={loadingPrograms}
            className="w-full rounded-xl border px-4 py-3"
          >
            {programs.map((program) => (
              <option key={program.programCode} value={program.programCode}>
                {program.displayLabel}
              </option>
            ))}
          </select>
        </div>

        {showBatch && setBatchCode && (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Batch
            </label>
            <select
              value={batchCode}
              onChange={(e) => setBatchCode(e.target.value)}
              disabled={loadingBatches}
              className="w-full rounded-xl border px-4 py-3"
            >
              {batches.map((batch) => (
                <option key={batch.id} value={batch.batchCode}>
                  {batch.batchCode}
                  {batch.admissionTerm ? ` — ${batch.admissionTerm}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {selectedProgram && (
        <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-4">
          <div>
            <span className="font-medium text-slate-700">Department:</span>{" "}
            {selectedProgram.departmentCode}
          </div>
          <div>
            <span className="font-medium text-slate-700">Program:</span>{" "}
            {selectedProgram.programCode}
          </div>
          <div>
            <span className="font-medium text-slate-700">Shift:</span>{" "}
            {selectedProgram.studyShift}
          </div>
          <div>
            <span className="font-medium text-slate-700">Curriculum:</span>{" "}
            {selectedProgram.curriculumVersion}
          </div>
        </div>
      )}
    </div>
  );
}
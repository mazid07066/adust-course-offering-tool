"use client";

import {
  AcademicCatalogProgramOption,
} from "@/hooks/use-academic-catalog-programs";
import { AcademicTermOption } from "@/hooks/use-academic-terms";

type Props = {
  programs: AcademicCatalogProgramOption[];
  programCode: string;
  setProgramCode: (value: string) => void;
  loadingPrograms?: boolean;
  terms: AcademicTermOption[];
  termName: string;
  setTermName: (value: string) => void;
  loadingTerms?: boolean;
};

export default function ProgramTermSelector({
  programs,
  programCode,
  setProgramCode,
  loadingPrograms = false,
  terms,
  termName,
  setTermName,
  loadingTerms = false,
}: Props) {
  const selectedProgram =
    programs.find((item) => item.programCode === programCode) || null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
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

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Academic Term
          </label>
          <select
            value={termName}
            onChange={(e) => setTermName(e.target.value)}
            disabled={loadingTerms}
            className="w-full rounded-xl border px-4 py-3"
          >
            {terms.map((term) => (
              <option key={term.id} value={term.name}>
                {term.name}
              </option>
            ))}
          </select>
        </div>
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
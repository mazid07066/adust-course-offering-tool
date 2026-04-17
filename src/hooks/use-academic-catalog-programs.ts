"use client";

import { useEffect, useState } from "react";

export type AcademicCatalogProgramOption = {
  id: string;
  departmentCode: string;
  departmentName: string;
  programCode: string;
  programTitle: string;
  programType: string;
  studyShift: string;
  curriculumVersion: string;
  displayLabel: string;
};

export function useAcademicCatalogPrograms() {
  const [programs, setPrograms] = useState<AcademicCatalogProgramOption[]>([]);
  const [programCode, setProgramCode] = useState("");
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [programError, setProgramError] = useState("");

  useEffect(() => {
    async function loadPrograms() {
      setLoadingPrograms(true);
      setProgramError("");

      try {
        const res = await fetch("/api/academic-catalog/options", {
          method: "GET",
          cache: "no-store",
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Failed to load academic catalog options.");
        }

        const list: AcademicCatalogProgramOption[] = json.programs || [];
        setPrograms(list);

        if (list.length > 0) {
          setProgramCode((prev) => prev || list[0].programCode);
        }
      } catch (error) {
        setProgramError(
          error instanceof Error
            ? error.message
            : "Failed to load academic catalog options."
        );
      } finally {
        setLoadingPrograms(false);
      }
    }

    loadPrograms();
  }, []);

  const selectedProgram =
    programs.find((item) => item.programCode === programCode) || null;

  return {
    programs,
    programCode,
    setProgramCode,
    selectedProgram,
    loadingPrograms,
    programError,
  };
}
"use client";

import { useEffect, useState } from "react";

export type AcademicTermOption = {
  id: number;
  name: string;
  year: number;
  termType: string;
};

export function useAcademicTerms() {
  const [terms, setTerms] = useState<AcademicTermOption[]>([]);
  const [termName, setTermName] = useState("");
  const [loadingTerms, setLoadingTerms] = useState(true);
  const [termError, setTermError] = useState("");

  useEffect(() => {
    async function loadTerms() {
      setLoadingTerms(true);
      setTermError("");

      try {
        const res = await fetch("/api/academic-terms/options", {
          method: "GET",
          cache: "no-store",
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Failed to load academic terms.");
        }

        const list: AcademicTermOption[] = json.terms || [];
        setTerms(list);

        if (list.length > 0) {
          setTermName((prev) => prev || list[0].name);
        }
      } catch (error) {
        setTermError(
          error instanceof Error
            ? error.message
            : "Failed to load academic terms."
        );
      } finally {
        setLoadingTerms(false);
      }
    }

    loadTerms();
  }, []);

  return {
    terms,
    termName,
    setTermName,
    loadingTerms,
    termError,
  };
}
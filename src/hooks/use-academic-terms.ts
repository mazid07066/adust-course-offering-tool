"use client";

import { useEffect, useState } from "react";

export type AcademicTermOption = {
  id: number;
  name: string;
  year: number;
  termType: string;
};

const ACTIVE_TERM_NAME = "SUMMER 2026";

const FALLBACK_TERM: AcademicTermOption = {
  id: 0,
  name: ACTIVE_TERM_NAME,
  year: 2026,
  termType: "SUMMER",
};

export function useAcademicTerms() {
  const [terms, setTerms] = useState<AcademicTermOption[]>([FALLBACK_TERM]);
  const [termName, setTermName] = useState(ACTIVE_TERM_NAME);
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

        const list: AcademicTermOption[] =
          Array.isArray(json.terms) && json.terms.length > 0
            ? json.terms
            : [FALLBACK_TERM];

        const summerOnly = list.filter(
          (term) => String(term.name || "").trim().toUpperCase() === ACTIVE_TERM_NAME
        );

        const finalList = summerOnly.length > 0 ? summerOnly : [FALLBACK_TERM];

        setTerms(finalList);
        setTermName(ACTIVE_TERM_NAME);
      } catch (error) {
        setTerms([FALLBACK_TERM]);
        setTermName(ACTIVE_TERM_NAME);
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
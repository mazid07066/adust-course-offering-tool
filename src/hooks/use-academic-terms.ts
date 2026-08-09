"use client";

import { useEffect, useState } from "react";

export type AcademicTermOption = {
  id: number;
  name: string;
  year: number;
  termType: string;
  isCurrent?: boolean;
  isActive?: boolean;
};

type AcademicTermApiRow = {
  id?: unknown;
  name?: unknown;
  year?: unknown;
  termType?: unknown;
  term_type?: unknown;
  isCurrent?: unknown;
  is_current?: unknown;
  isActive?: unknown;
  is_active?: unknown;
};

const FALLBACK_TERM: AcademicTermOption = {
  id: 0,
  name: "FALL 2026",
  year: 2026,
  termType: "FALL",
  isCurrent: true,
  isActive: true,
};

function normalizeUpper(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

export function useAcademicTerms() {
  const [terms, setTerms] =
    useState<AcademicTermOption[]>([
      FALLBACK_TERM,
    ]);

  const [termName, setTermName] =
    useState(FALLBACK_TERM.name);

  const [loadingTerms, setLoadingTerms] =
    useState(true);

  const [termError, setTermError] =
    useState("");

  useEffect(() => {
    async function loadTerms() {
      setLoadingTerms(true);
      setTermError("");

      try {
        const res = await fetch(
          "/api/academic-terms/options",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const json: {
          terms?: AcademicTermApiRow[];
          error?: string;
        } = await res.json();

        if (!res.ok) {
          throw new Error(
            json.error ||
              "Failed to load academic terms."
          );
        }

        const rawTerms: AcademicTermApiRow[] =
          Array.isArray(json.terms)
            ? json.terms
            : [];

        const list: AcademicTermOption[] =
          rawTerms
            .map(
              (
                term: AcademicTermApiRow
              ): AcademicTermOption => ({
                id: Number(
                  term.id || 0
                ),

                name: String(
                  term.name || ""
                ).trim(),

                year: Number(
                  term.year || 0
                ),

                termType: String(
                  term.termType ||
                    term.term_type ||
                    ""
                )
                  .trim()
                  .toUpperCase(),

                isCurrent: Boolean(
                  term.isCurrent ??
                    term.is_current
                ),

                isActive:
                  term.isActive !==
                  undefined
                    ? Boolean(
                        term.isActive
                      )
                    : term.is_active !==
                        undefined
                      ? Boolean(
                          term.is_active
                        )
                      : true,
              })
            )
            .filter(
              (
                term: AcademicTermOption
              ) =>
                term.id > 0 &&
                Boolean(term.name)
            );

        const finalList:
          AcademicTermOption[] =
          list.length > 0
            ? list
            : [FALLBACK_TERM];

        const currentTerm =
          finalList.find(
            (
              term:
                AcademicTermOption
            ) =>
              term.isCurrent ===
              true
          );

        const fall2026 =
          finalList.find(
            (
              term:
                AcademicTermOption
            ) =>
              normalizeUpper(
                term.name
              ) ===
              "FALL 2026"
          );

        const defaultTerm =
          currentTerm ||
          fall2026 ||
          finalList[0];

        setTerms(finalList);

        setTermName(
          defaultTerm?.name ||
            FALLBACK_TERM.name
        );
      } catch (error) {
        setTerms([
          FALLBACK_TERM,
        ]);

        setTermName(
          FALLBACK_TERM.name
        );

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
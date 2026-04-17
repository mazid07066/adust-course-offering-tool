"use client";

import { useEffect, useState } from "react";

export type ProgramBatchOption = {
  id: number;
  batchCode: string;
  admissionTerm: string | null;
};

export function useProgramBatches(programCode: string) {
  const [batches, setBatches] = useState<ProgramBatchOption[]>([]);
  const [batchCode, setBatchCode] = useState("");
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [batchError, setBatchError] = useState("");

  useEffect(() => {
    async function loadBatches() {
      if (!programCode) {
        setBatches([]);
        setBatchCode("");
        return;
      }

      setLoadingBatches(true);
      setBatchError("");

      try {
        const res = await fetch(
          `/api/program-batches/options?programCode=${encodeURIComponent(
            programCode
          )}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Failed to load batch options.");
        }

        const list: ProgramBatchOption[] = json.batches || [];
        setBatches(list);
        setBatchCode((prev) => {
          if (prev && list.some((b) => b.batchCode === prev)) return prev;
          return list.length > 0 ? list[0].batchCode : "";
        });
      } catch (error) {
        setBatchError(
          error instanceof Error ? error.message : "Failed to load batch options."
        );
      } finally {
        setLoadingBatches(false);
      }
    }

    loadBatches();
  }, [programCode]);

  return {
    batches,
    batchCode,
    setBatchCode,
    loadingBatches,
    batchError,
  };
}
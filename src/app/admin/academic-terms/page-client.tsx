"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin-layout";

type Term = {
  id: number;
  name: string;
  year: number;
  term_type: string;
};

export default function AcademicTermsClient() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [error, setError] = useState("");

  async function loadTerms() {
    const res = await fetch("/api/academic-terms/list");
    const json = await res.json();
    setTerms(json.terms || []);
  }

  async function deleteTerm(id: number) {
    if (!confirm("Delete this term?")) return;

    const res = await fetch("/api/academic-terms/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ termId: id }),
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json.error || "Delete failed");
      return;
    }

    loadTerms();
  }

  useEffect(() => {
    loadTerms();
  }, []);

  return (
    <AdminLayout title="Academic Terms">
      <div className="space-y-4">
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded">{error}</div>
        )}

        {terms.map((term) => (
          <div
            key={term.id}
            className="flex items-center justify-between border p-4 rounded"
          >
            <div>
              <p className="font-semibold">{term.name}</p>
              <p className="text-sm text-gray-500">
                {term.term_type} {term.year}
              </p>
            </div>

            <button
              onClick={() => deleteTerm(term.id)}
              className="bg-red-600 text-white px-3 py-1 rounded"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
// File: app/dashboard/editorial/plag/page.tsx
import React from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export const revalidate = 0;

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function looksLikeUuid(v: unknown) {
  return typeof v === "string" && /^[0-9a-fA-F-]{36}$/.test(v);
}

export default async function Page() {
  // 1) fetch reports (no relation embedding)
  const { data: reportsData, error: reportsError } = await supabase
    .from("plagiarism_reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (reportsError) {
    console.error("Error fetching plagiarism reports:", reportsError);
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Plagiarism reports</h1>
        <div className="text-red-600">
          Failed to load plagiarism reports: {reportsError.message}
        </div>
      </div>
    );
  }

  const reports = (reportsData as any[]) ?? [];

  // 2) collect all referenced paper IDs found in *_id columns across all reports
  const paperIdSet = new Set<string>();
  for (const rpt of reports) {
    for (const key of Object.keys(rpt)) {
      // treat keys that end with "_id" and look like a uuid as references
      if (/_id$/.test(key) && looksLikeUuid(rpt[key])) {
        paperIdSet.add(rpt[key]);
      }
      // If you have JSON arrays of ids (e.g., paper_ids), include basic support:
      if (key.endsWith("_ids") && Array.isArray(rpt[key])) {
        for (const maybeId of rpt[key]) {
          if (looksLikeUuid(maybeId)) paperIdSet.add(maybeId);
        }
      }
    }
  }

  const paperIds = Array.from(paperIdSet);

  // 3) fetch the paper titles for all referenced paper IDs (if any)
  let papersMap: Record<string, { id: string; title?: string | null }> = {};
  if (paperIds.length > 0) {
    const { data: papers, error: papersError } = await supabase
      .from("papers")
      .select("id, title")
      .in("id", paperIds);

    if (papersError) {
      console.error("Error fetching papers for plagiarism reports:", papersError);
      // proceed without paper titles — still render reports
    } else if (papers) {
      for (const p of papers as any[]) {
        papersMap[p.id] = p;
      }
    }
  }

  // 4) Attach found papers to each report for rendering
  const enrichedReports = reports.map((r: any) => {
    const related: Array<{ key: string; id: string; title?: string | null }> = [];

    for (const key of Object.keys(r)) {
      if (/_id$/.test(key) && looksLikeUuid(r[key])) {
        related.push({ key, id: r[key], title: papersMap[r[key]]?.title ?? null });
      }
      if (key.endsWith("_ids") && Array.isArray(r[key])) {
        for (const maybeId of r[key]) {
          if (looksLikeUuid(maybeId)) {
            related.push({ key, id: maybeId, title: papersMap[maybeId]?.title ?? null });
          }
        }
      }
    }

    return { ...r, relatedPapers: related };
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Plagiarism reports</h1>

      {enrichedReports.length === 0 ? (
        <div className="text-muted-foreground">No reports found.</div>
      ) : (
        <div className="space-y-4">
          {enrichedReports.map((r: any) => (
            <div
              key={r.id}
              className="border rounded-lg p-4 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3"
            >
              <div>
                <div className="text-sm text-slate-500">Report ID</div>
                <div className="text-base font-medium break-all">{r.id}</div>

                <div className="mt-3">
                  <div className="text-sm text-slate-500">Related paper(s)</div>
                  {r.relatedPapers && r.relatedPapers.length > 0 ? (
                    <ul className="list-disc ml-5 mt-2">
                      {r.relatedPapers.map((p: any, idx: number) => (
                        <li key={p.key + p.id + idx}>
                          <Link
                            href={`/dashboard/editorial/papers/${p.id}`}
                            className="text-indigo-600 hover:underline"
                          >
                            {p.title ?? p.id}{" "}
                          </Link>
                          <span className="text-sm text-slate-500">({p.key})</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-gray-600">No linked papers detected</div>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <div className="text-sm text-slate-500">Provider</div>
                    <div>{r.provider ?? "—"}</div>
                  </div>

                  <div>
                    <div className="text-sm text-slate-500">Similarity</div>
                    <div>
                      {r.similarity_score != null
                        ? `${Number(r.similarity_score).toFixed(2)}%`
                        : "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-slate-500">Created</div>
                    <div>{formatDate(r.created_at)}</div>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 flex items-center gap-3">
                {r.report_url ? (
                  <a
                    href={r.report_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-3 py-2 border rounded hover:bg-gray-50"
                  >
                    View report
                  </a>
                ) : (
                  <span className="text-sm text-gray-500">No report URL</span>
                )}

                <Link
                  href={`/dashboard/editorial/plag/${r.id}`}
                  className="inline-block px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  Open
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
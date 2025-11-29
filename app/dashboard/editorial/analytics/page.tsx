'use client';

import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ReviewerMetric = {
  reviewer_id: string;
  reviewer_name?: string;
  assigned_count: number;
  submitted_count: number;
  avg_days_to_submit: number;
  on_time_pct: number;
};

type SubmissionStat = {
  day: string; // 'YYYY-MM-DD'
  total_submissions: number;
  total_published: number;
  total_under_review: number;
  acceptance_rate?: number | null; // percent (12.34) or null
};

type AcceptancePoint = { period: string; accepted: number; submitted: number };

type AnalyticsResponse = {
  reviewerMetrics: ReviewerMetric[];
  submissionStats: SubmissionStat[];
  acceptanceRate: AcceptancePoint[];
};

export default function EditorialAnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch('/api/analytics')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load analytics: ' + r.status);
        return r.json();
      })
      .then((payload: AnalyticsResponse) => {
        if (!mounted) return;
        console.debug('Analytics payload:', payload); // <<--- inspect this in browser console
        setData(payload);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error(err);
        setError(err.message || 'Unknown error');
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div className="p-6">Loading analytics…</div>;
  if (error) return <div className="p-6 text-red-600">Error loading analytics: {error}</div>;
  if (!data) return <div className="p-6">No analytics available.</div>;

  // ---------- Helper coercion helpers ----------
  const toNum = (v: any) => {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // --- Reviewer chart data
  const reviewerBarData = (data.reviewerMetrics ?? []).map((r) => ({
    name: r.reviewer_name ?? r.reviewer_id.slice(0, 8),
    assigned: toNum(r.assigned_count),
    submitted: toNum(r.submitted_count),
    avgDays: Number((r.avg_days_to_submit ?? 0).toFixed(2)),
  }));

  // --- Submission time-series data (coerce types)
  const submissionLineData: SubmissionStat[] = (data.submissionStats ?? []).map((s: any) => ({
    day: typeof s.day === 'string' ? s.day : (s.day instanceof Date ? s.day.toISOString().slice(0, 10) : String(s.day ?? '')),
    total_submissions: toNum(s.total_submissions),
    total_published: toNum(s.total_published),
    total_under_review: toNum(s.total_under_review),
    acceptance_rate: s.acceptance_rate === null || s.acceptance_rate === undefined ? null : toNum(s.acceptance_rate),
  }));

  // Basic KPIs (safe sums)
  const totalSubmissionsAll = submissionLineData.reduce((acc, d) => acc + toNum(d.total_submissions), 0);
  const totalPublishedAll = submissionLineData.reduce((acc, d) => acc + toNum(d.total_published), 0);
    // overall acceptance percent across all days (null when no submissions)
  const overallAcceptance = totalSubmissionsAll === 0 ? null : (totalPublishedAll / totalSubmissionsAll) * 100;


  // Latest day (safely) for pie & latest acceptance
  const latest = submissionLineData.length ? submissionLineData[submissionLineData.length - 1] : null;

  // --- Option C: single-day pie for latest day (Accepted / Under review / Other)
  const acceptancePieData =
  latest != null
    ? [
        { name: 'Accepted', value: toNum(latest.total_published) },
        { name: 'Under review', value: toNum(latest.total_under_review) },
      ]
    : [];


  const PIE_COLORS = ['#10B981', '#06B6D4'];

  // If no submission data, show friendly message on charts
  const hasSubmissionData = submissionLineData.length > 0 && submissionLineData.some((d) => d.total_submissions > 0);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Editorial Analytics</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Reviewer Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={reviewerBarData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="assigned" name="Assigned" fill="#4F46E5" />
                  <Bar dataKey="submitted" name="Submitted" fill="#10B981" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="pb-2">Reviewer</th>
                    <th className="pb-2">Assigned</th>
                    <th className="pb-2">Submitted</th>
                    <th className="pb-2">Avg days</th>
                  </tr>
                </thead>
                <tbody>
                  {data.reviewerMetrics.slice(0, 6).map((r) => (
                    <tr key={r.reviewer_id} className="border-b">
                      <td className="py-2">{r.reviewer_name ?? r.reviewer_id.slice(0, 8)}</td>
                      <td className="py-2">{toNum(r.assigned_count)}</td>
                      <td className="py-2">{toNum(r.submitted_count)}</td>
                      <td className="py-2">{(r.avg_days_to_submit ?? 0).toFixed(1)} days</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Submission Trends (by day)</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ width: '100%', height: 320 }}>
              {hasSubmissionData ? (
                <ResponsiveContainer>
                  <LineChart data={submissionLineData} margin={{ top: 10, right: 50, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(v: any) => (v === null || v === undefined ? '' : `${v}%`)}
                      domain={[0, 'dataMax']}
                    />
                    <Tooltip
                      formatter={(value: any, name: string) => {
                        if (name === 'Acceptance %') {
                          return value === null ? ['—', name] : [`${value}%`, name];
                        }
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="total_submissions" name="Submissions" stroke="#4F46E5" dot={false} />
                    <Line yAxisId="left" type="monotone" dataKey="total_published" name="Published" stroke="#10B981" dot={false} />
                    <Line yAxisId="left" type="monotone" dataKey="total_under_review" name="Under Review" stroke="#06B6D4" dot={false} />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="acceptance_rate"
                      name="Acceptance %"
                      stroke="#F59E0B"
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-slate-500">
                  No submission stats available yet. Run the scheduler or backfill the <code>submission_stats</code> table.
                </div>
              )}
            </div>

            <div className="mt-4 text-sm">
              <p className="mb-2">
                Showing totals by day from the <code>submission_stats</code> table. If the X-axis is crowded we can add a date picker or aggregate monthly.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Acceptance Snapshot (latest day)</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ width: '100%', height: 260 }}>
              {latest ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={acceptancePieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent = 0 }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {acceptancePieData.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any, name: string) => [value, name]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-slate-500">
                  No latest submission data to show.
                </div>
              )}
            </div>

            <div className="mt-4 text-sm">
              <p className="mb-2">
                Pie shows composition for the latest available day: <strong>Accepted</strong> vs <strong>Under review</strong> vs <strong>Other</strong>.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick KPIs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded">
                <div className="text-xs">Total submissions (all days)</div>
                <div className="text-2xl font-semibold">{totalSubmissionsAll}</div>
              </div>
              <div className="p-4 bg-slate-50 rounded">
                <div className="text-xs">Total published</div>
                <div className="text-2xl font-semibold">{totalPublishedAll}</div>
              </div>
              <div className="p-4 bg-slate-50 rounded">
  <div className="text-xs">Acceptance % (all time)</div>
  <div className="text-2xl font-semibold">
    {overallAcceptance === null ? '—' : `${overallAcceptance.toFixed(2)}%`}
  </div>
</div>


              <div className="p-4 bg-slate-50 rounded">
                <div className="text-xs">Active reviewers</div>
                <div className="text-2xl font-semibold">{(data.reviewerMetrics ?? []).length}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-slate-500">
        NOTE: This page expects an API endpoint at <code className="rounded bg-slate-100 px-1">/api/analytics</code> that returns aggregated objects for <code>reviewerMetrics</code>, <code>submissionStats</code> and <code>acceptanceRate</code>. If you still see zeros, open the browser console and inspect the object logged under <code>Analytics payload:</code>.
      </p>
    </div>
  );
}
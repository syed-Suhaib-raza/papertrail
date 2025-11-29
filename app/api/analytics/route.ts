import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Missing SUPABASE env. Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

export async function GET() {
  try {
    // Load profiles (we'll include every profile as a potential reviewer)
    const { data: profiles = [], error: profilesErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'reviewer')
      .limit(20000);

    if (profilesErr) console.warn('profiles read error', profilesErr);

    // Load assignments and reviews
    const [{ data: assignments = [] }, { data: reviews = [] }] = await Promise.all([
      supabaseAdmin.from('review_assignments').select('id, reviewer_id, assigned_at, due_date, status').limit(20000),
      supabaseAdmin.from('reviews').select('id, reviewer_id, assignment_id, submitted_at').limit(20000),
    ]);

    // Initialize map with all profiles so everyone appears even with zero activity
    const byReviewer: Record<string, any> = {};
    profiles?.forEach((p: any) => {
      const rid = String(p.id);
      byReviewer[rid] = {
        reviewer_id: rid,
        reviewer_name: p.full_name ?? p.email ?? rid,
        assigned_count: 0,
        submitted_count: 0,
        total_days_to_submit: 0,
        submissions_for_avg: 0,
        on_time_count: 0,
      };
    });

    // Aggregate assignments
    (assignments ?? []).forEach((a: any) => {
      const rid = String(a.reviewer_id);
      if (!byReviewer[rid]) {
        // If assignment references a reviewer not present in profiles, create a placeholder
        byReviewer[rid] = {
          reviewer_id: rid,
          reviewer_name: rid,
          assigned_count: 0,
          submitted_count: 0,
          total_days_to_submit: 0,
          submissions_for_avg: 0,
          on_time_count: 0,
        };
      }
      byReviewer[rid].assigned_count += 1;
    });

    // Aggregate reviews
    (reviews ?? []).forEach((rv: any) => {
      const rid = String(rv.reviewer_id);
      if (!byReviewer[rid]) {
        byReviewer[rid] = {
          reviewer_id: rid,
          reviewer_name: rid,
          assigned_count: 0,
          submitted_count: 0,
          total_days_to_submit: 0,
          submissions_for_avg: 0,
          on_time_count: 0,
        };
      }
      byReviewer[rid].submitted_count += 1;

      // compute days to submit when possible
      const assignment = (assignments ?? []).find((a: any) => a.id === rv.assignment_id);
      if (assignment && rv.submitted_at) {
        const assignedAt = assignment.assigned_at ? new Date(assignment.assigned_at) : null;
        const submittedAt = new Date(rv.submitted_at);
        if (assignedAt) {
          const days = (submittedAt.getTime() - assignedAt.getTime()) / (1000 * 60 * 60 * 24);
          byReviewer[rid].total_days_to_submit += days;
          byReviewer[rid].submissions_for_avg += 1;
          if (assignment.due_date) {
            const due = new Date(assignment.due_date);
            if (submittedAt <= due) byReviewer[rid].on_time_count += 1;
          } else {
            byReviewer[rid].on_time_count += 1; // count as on-time if no due date
          }
        }
      }
    });

    // Build reviewerMetrics array
    const reviewerMetrics = Object.values(byReviewer).map((r: any) => {
      const avg_days_to_submit = r.submissions_for_avg > 0 ? r.total_days_to_submit / r.submissions_for_avg : 0;
      const on_time_pct = r.submissions_for_avg > 0 ? (r.on_time_count / r.submissions_for_avg) * 100 : 0;
      return {
        reviewer_id: r.reviewer_id,
        reviewer_name: r.reviewer_name,
        assigned_count: Number(r.assigned_count ?? 0),
        submitted_count: Number(r.submitted_count ?? 0),
        avg_days_to_submit: Number(Number(avg_days_to_submit).toFixed(2)),
        on_time_pct: Number(Number(on_time_pct).toFixed(2)),
      };
    });

        // submissionStats: try to read submission_stats table if present (include acceptance_rate)
    const { data: submissionStatsRows = [], error: submissionStatsErr } = await supabaseAdmin
      .from('submission_stats')
      .select('day, total_submissions, total_published, total_under_review, acceptance_rate')
      .order('day', { ascending: true });

    if (submissionStatsErr) console.warn('submission_stats read error', submissionStatsErr);

    const submissionStats = (submissionStatsRows ?? []).map((r: any) => ({
      day: (r.day instanceof Date) ? r.day.toISOString().slice(0,10) : String(r.day),
      total_submissions: Number(r.total_submissions ?? 0),
      total_published: Number(r.total_published ?? 0),
      total_under_review: Number(r.total_under_review ?? 0),
      // acceptance_rate stored as numeric(5,2) percent (e.g. 12.34) or null
      acceptance_rate: r.acceptance_rate === null ? null : Number(r.acceptance_rate),
    }));


    // acceptanceRate: derive from papers table by month
    const { data: papersRows = [], error: papersErr } = await supabaseAdmin
      .from('papers')
      .select('id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (papersErr) console.warn('papers read error', papersErr);

    const buckets: Record<string, { submitted: number; accepted: number }> = {};
    (papersRows ?? []).forEach((p: any) => {
      const created = p.created_at ? new Date(p.created_at) : null;
      if (!created) return;
      const period = `${created.getUTCFullYear()}-${String(created.getUTCMonth() + 1).padStart(2, '0')}`;
      if (!buckets[period]) buckets[period] = { submitted: 0, accepted: 0 };
      buckets[period].submitted += 1;
      if (p.status === 'published' || p.status === 'accepted') buckets[period].accepted += 1;
    });

    const acceptanceRate = Object.keys(buckets)
      .sort()
      .map((period) => ({ period, submitted: buckets[period].submitted, accepted: buckets[period].accepted }));

    const payload = {
      reviewerMetrics,
      submissionStats,
      acceptanceRate,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    console.error('analytics error', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
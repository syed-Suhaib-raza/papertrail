// lib/reviewerAnalytics.ts
export async function logReviewerActivity({ reviewerId, assignmentId, action, details = {} }: {
  reviewerId: string;
  assignmentId?: string;
  action: string;
  details?: any;
}) {
  try {
    const res = await fetch('/api/log-reviewer-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer_id: reviewerId, assignment_id: assignmentId, action, details })
    });
    return await res.json();
  } catch (err) {
    console.error('failed to log reviewer activity', err);
    return { ok: false, error: err || err };
  }
}
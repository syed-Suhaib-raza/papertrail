// services/reviewer.service.ts
import { createClient } from '@supabase/supabase-js';
const srv = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function getAssignmentsForReviewer(reviewerId: string) {
  const { data, error } = await srv.from('review_assignments')
    .select('*, papers (*)')
    .eq('reviewer_id', reviewerId)
    .order('due_date', { ascending: true });
  if (error) throw error;
  return data;
}
// File: lib/notificationHelpers.ts

export function renderTitle(n: any) {
  try {
    switch (n.type) {
      case 'paper_status_change':
        return `Paper \"${n.payload.title || n.payload.paper_id}\" ${n.payload.new_status}`;
      case 'review_assignment':
        return `You were assigned to review paper #${n.payload.paper_id}`;
      case 'paper_needs_decision':
        return `Paper #${n.payload.paper_id} needs decision`;
      default:
        return n.type;
    }
  } catch {
    return n.type;
  }
}
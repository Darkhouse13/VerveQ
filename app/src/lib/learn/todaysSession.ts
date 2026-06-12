/**
 * Picks which node "Today's session" should run, from the server review plan.
 * Priority: most overdue items first, then anything still being learned,
 * then the first node of the subject. Returns null while the plan is empty —
 * the entry screen keeps Start disabled rather than falling back to any
 * fixture content.
 */
export interface TodaysSessionNode {
  id: string;
  due?: number;
  state?: string;
  /** Server playability flag; "coming soon" nodes must never start a session. */
  playable?: boolean;
}

export function pickTodaysSessionNode(nodes: readonly TodaysSessionNode[]): string | null {
  // Unplayable (coming-soon) nodes are listed for honesty but can't serve a
  // ladder — starting one would only error server-side.
  const startable = nodes.filter((node) => node.playable !== false);
  if (!startable.length) return null;
  const due = [...startable]
    .filter((node) => (node.due ?? 0) > 0)
    .sort((a, b) => (b.due ?? 0) - (a.due ?? 0));
  if (due.length) return due[0].id;
  const learning = startable.find((node) => node.state === "learning");
  if (learning) return learning.id;
  return startable[0].id;
}

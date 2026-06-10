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
}

export function pickTodaysSessionNode(nodes: readonly TodaysSessionNode[]): string | null {
  if (!nodes.length) return null;
  const due = [...nodes]
    .filter((node) => (node.due ?? 0) > 0)
    .sort((a, b) => (b.due ?? 0) - (a.due ?? 0));
  if (due.length) return due[0].id;
  const learning = nodes.find((node) => node.state === "learning");
  if (learning) return learning.id;
  return nodes[0].id;
}

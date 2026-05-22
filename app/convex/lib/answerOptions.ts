export function answerSlot(seed: string, optionCount: number) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % optionCount;
}

export function orderAnswerOptions(
  options: string[],
  correctAnswer: string,
  seed: string,
) {
  if (options.length < 2) return options;
  const correctIndex = options.indexOf(correctAnswer);
  if (correctIndex < 0) return options;

  const ordered = [...options];
  const targetIndex = answerSlot(seed, ordered.length);
  [ordered[correctIndex], ordered[targetIndex]] = [
    ordered[targetIndex],
    ordered[correctIndex],
  ];
  return ordered;
}

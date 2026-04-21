import { evaluateCuratedParityDestructiveGuard } from "../../scripts/curatedParityDeploymentSafety";

// This should trigger the lint warning
type BadPattern = Parameters<typeof evaluateCuratedParityDestructiveGuard>[2];

export const someTest = () => {
  const deps: BadPattern = {};
  console.log(deps);
};

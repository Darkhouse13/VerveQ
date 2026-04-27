import type { CuratedParityGuardEvaluationDependencies } from "../../scripts/curatedParityDeploymentSafety";

type ExplicitSeam = CuratedParityGuardEvaluationDependencies;

export const someTest = () => {
  const deps: ExplicitSeam = {};
  console.log(deps);
};

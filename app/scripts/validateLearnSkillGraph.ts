import {
  formatLearnSkillGraphValidationReport,
  validateLearnSkillGraph,
} from "../convex/learnQuestionSkillTags";

const report = validateLearnSkillGraph();

console.log(formatLearnSkillGraphValidationReport(report));

if (!report.acyclic || report.errors.length > 0) {
  process.exitCode = 1;
}

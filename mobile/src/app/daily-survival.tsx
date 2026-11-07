import { SurvivalGame } from "@/components/survival/SurvivalGame";

// The shared daily run: football, one attempt per UTC day, never touches ELO.
export default function DailySurvivalScreen() {
  return <SurvivalGame daily />;
}

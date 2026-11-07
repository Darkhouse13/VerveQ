import { SurvivalGame } from "@/components/survival/SurvivalGame";

// Ranked Survival (full account only; guests see the create-account gate).
export default function SurvivalScreen() {
  return <SurvivalGame daily={false} />;
}

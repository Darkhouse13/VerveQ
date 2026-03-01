// Cross-platform haptics wrapper.
// Uses expo-haptics if available; falls back to no-op to avoid native module errors in web or missing platforms.
let impactAsync = async () => {};
let selectionAsync = async () => {};

try {
  // Lazy require to avoid build-time failure if not installed
  const ExpoHaptics = require('expo-haptics');
  impactAsync = (style = 'Light') => {
    const map = {
      Light: ExpoHaptics.ImpactFeedbackStyle.Light,
      Medium: ExpoHaptics.ImpactFeedbackStyle.Medium,
      Heavy: ExpoHaptics.ImpactFeedbackStyle.Heavy,
    };
    return ExpoHaptics.impactAsync(map[style] || ExpoHaptics.ImpactFeedbackStyle.Light);
  };
  selectionAsync = () => ExpoHaptics.selectionAsync();
} catch (e) {
  // Silent fallback
}

export const haptics = {
  impact: impactAsync,
  selection: selectionAsync,
};

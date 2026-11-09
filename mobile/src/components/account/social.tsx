import { GoogleLogo } from "phosphor-react-native/src/icons/GoogleLogo";
import { Text, View } from "react-native";

import { Eyebrow, Txt } from "@/components/ui";
import { color, font, size, space } from "@/theme/tokens";

export function GoogleButton() {
  // Google sign-in needs a Convex Auth provider that isn't deployed yet.
  return (
    <View style={{ gap: space.s }}>
      <View
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        accessibilityLabel="Continue with Google, coming soon"
        style={{
          height: size.buttonPrimary,
          borderRadius: size.buttonPrimary / 2,
          backgroundColor: color.cream,
          opacity: 0.45,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.m,
        }}
      >
        <GoogleLogo size={20} weight="bold" color={color.ink} />
        <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.bold, fontSize: 17, color: color.ink }}>Continue with Google</Text>
      </View>
      <Txt v="micro" c={color.dim} center style={{ fontFamily: font.medium }}>
        Google sign-in is coming soon
      </Txt>
    </View>
  );
}

export function OrDivider({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
      <View style={{ flex: 1, height: 1, backgroundColor: color.line }} />
      <Eyebrow c={color.dim}>{label}</Eyebrow>
      <View style={{ flex: 1, height: 1, backgroundColor: color.line }} />
    </View>
  );
}


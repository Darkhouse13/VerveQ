import { TextInput, type TextInputProps } from "react-native";

import { color, font, radius, size, space } from "@/theme/tokens";

/** 56px name field from the design spec (inputs: radius 16, padding 0 16). */
export function NameInput({ active, style, ...props }: TextInputProps & { active?: boolean }) {
  return (
    <TextInput maxFontSizeMultiplier={1.3}
      placeholderTextColor={color.dim}
      autoCapitalize="words"
      autoCorrect={false}
      autoComplete="off"
      returnKeyType="go"
      selectionColor={color.lime}
      cursorColor={color.lime}
      {...props}
      style={[
        {
          height: size.input,
          borderRadius: radius.input,
          borderWidth: 1.5,
          borderColor: active ? color.lime : color.line,
          backgroundColor: color.surface,
          paddingHorizontal: space.l,
          color: color.cream,
          fontFamily: font.bold,
          fontSize: 17,
        },
        style,
      ]}
    />
  );
}

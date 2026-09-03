import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { Colors, Spacing } from "@/constants/theme";
import { ThemedText } from "@/components/themed-text";

export type ButtonVariant = "primary" | "ghost" | "danger";

export interface ButtonProps extends Omit<PressableProps, "style"> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Matches the web app's .btn / .btn.gh — a solid brand-green primary action, a bordered ghost for secondary ones. Always >=44px tall (WCAG 2.5.5 tap-target minimum), same low-literacy design principle as web's .tap-target. */
export function Button({
  label,
  variant = "primary",
  loading,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  return (
    <Pressable
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" && styles.primary,
        variant === "ghost" && styles.ghost,
        variant === "danger" && styles.danger,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "ghost" ? Colors.verified : Colors.surface} />
      ) : (
        <ThemedText type="smallBold" color={variant === "ghost" ? "verified" : "surface"}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    borderRadius: 6,
    paddingHorizontal: Spacing.four,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  primary: {
    backgroundColor: Colors.verified,
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.verified,
  },
  danger: {
    backgroundColor: Colors.seal,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
});

import { View, type ViewProps } from "react-native";

import type { ThemeColorKey } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type ThemedViewProps = ViewProps & {
  color?: ThemeColorKey;
};

/** Defaults to the app's background chrome color. Use color="surface" for a cream card on top of it. */
export function ThemedView({ style, color, ...otherProps }: ThemedViewProps) {
  const theme = useTheme();

  return <View style={[{ backgroundColor: theme[color ?? "background"] }, style]} {...otherProps} />;
}

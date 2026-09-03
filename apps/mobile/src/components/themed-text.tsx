import { Platform, StyleSheet, Text, type TextProps } from "react-native";

import { Fonts, type ThemeColorKey } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type ThemedTextProps = TextProps & {
  type?: "default" | "title" | "small" | "smallBold" | "subtitle" | "link" | "code";
  color?: ThemeColorKey;
};

/** Defaults to onBackground — most text sits directly on the app's dark bottle-green chrome, matching the web app's body default. */
export function ThemedText({ style, type = "default", color, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[color ?? "onBackground"] },
        type === "default" && styles.default,
        type === "title" && styles.title,
        type === "small" && styles.small,
        type === "smallBold" && styles.smallBold,
        type === "subtitle" && styles.subtitle,
        type === "link" && styles.link,
        type === "code" && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 13,
    lineHeight: 18,
  },
  smallBold: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 26,
  },
  link: {
    lineHeight: 22,
    fontSize: 15,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: "700" }) ?? "500",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

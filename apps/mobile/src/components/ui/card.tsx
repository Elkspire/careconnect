import { StyleSheet, View, type ViewProps } from "react-native";

import { Colors, Spacing } from "@/constants/theme";

/** The cream "paper" card surface most content sits on, matching web's .card/.slip. */
export function Card({ style, ...rest }: ViewProps) {
  return <View style={[styles.card, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 6,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});

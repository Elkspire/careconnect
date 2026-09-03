import { Pressable, StyleSheet, View } from "react-native";

import { Colors, Spacing } from "@/constants/theme";
import { ThemedText } from "@/components/themed-text";

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <View style={[styles.chip, selected && styles.chipSelected]}>
        <ThemedText type="small" color={selected ? "surface" : "onSurface"}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 40,
    justifyContent: "center",
  },
  chipSelected: {
    backgroundColor: Colors.verified,
    borderColor: Colors.verified,
  },
});

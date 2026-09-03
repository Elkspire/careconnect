import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { Colors, Spacing } from "@/constants/theme";
import { ThemedText } from "@/components/themed-text";

export interface TextFieldProps extends TextInputProps {
  label: string;
}

export function TextField({ label, style, ...rest }: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      <ThemedText type="small" color="onBackgroundMuted" style={styles.label}>
        {label}
      </ThemedText>
      <TextInput
        placeholderTextColor={Colors.onSurfaceMuted}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.one,
  },
  label: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    minHeight: 44,
    backgroundColor: Colors.surface,
    color: Colors.onSurface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.two,
    fontSize: 16,
  },
});

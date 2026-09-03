import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors, Spacing } from "@/constants/theme";
import { ThemedText } from "@/components/themed-text";

/** Standard page shell: dark chrome background, safe-area padding, scrollable. */
export function Screen({
  children,
  scroll = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const Wrapper = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
      <Wrapper
        style={styles.flex}
        contentContainerStyle={scroll ? styles.content : undefined}
      >
        {scroll ? children : <View style={styles.content}>{children}</View>}
      </Wrapper>
    </SafeAreaView>
  );
}

export function LoadingState() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={Colors.mint} size="large" />
    </View>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <View style={styles.centered}>
      <ThemedText color="onBackgroundMuted">{message}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
  },
});

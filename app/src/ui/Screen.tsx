import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollEdge } from "./Glass.tsx";
import { RevealWords } from "./reveal.tsx";
import { space, type, useTheme } from "./theme.ts";

/** Room for the floating glass tab bar, so the last content can scroll above it. */
export const useTabBarSpace = () => useSafeAreaInsets().bottom + 96;

/** Tab screen: brand gradient, large title in the content (iOS style), content scrolls under the floating tab bar. */
export function Screen({
  title,
  accessory,
  children,
  contentStyle,
}: {
  title?: string;
  accessory?: ReactNode;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarSpace();
  return (
    <View style={styles.root}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[{ paddingTop: insets.top + space.l, paddingBottom: bottom, paddingHorizontal: space.l, gap: space.xl }, contentStyle]}
      >
        {title ? (
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }} accessibilityRole="header">
              <RevealWords text={title} style={[type.display, { color: c.text }]} stagger={60} />
            </View>
            {accessory}
          </View>
        ) : null}
        {children}
      </ScrollView>
      <ScrollEdge />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.m, marginTop: space.s },
});

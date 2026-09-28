import { View, Text, StyleSheet } from "react-native";
import { ReactNode } from "react";

type ScreenProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
};

// Wrapper simple para que las 7 pantallas compartan el mismo look
// mientras se van llenando de contenido real en los siguientes Sprints.
export default function Screen({ title, subtitle, children }: ScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingTop: 80, paddingHorizontal: 24 },
  title: { fontSize: 22, fontWeight: "700", color: "#111111" },
  subtitle: { fontSize: 13, color: "#666666", marginTop: 6 },
  body: { marginTop: 20, gap: 12 },
});

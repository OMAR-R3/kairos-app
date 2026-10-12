import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import NavButton from "../components/NavButton";

export default function ConfirmacionScreen() {
  const { folio } = useLocalSearchParams<{ folio: string }>();

  return (
    <Screen title="Solicitud enviada" subtitle="">
      <View style={styles.container}>
        <Text style={styles.label}>Folio</Text>
        <Text style={styles.folio}>{folio ?? "KV-000000"}</Text>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>Pendiente de aprobacion</Text>
        </View>

        <Text style={styles.info}>
          Recibiras una notificacion cuando tu visita sea aprobada
        </Text>
      </View>

      <NavButton label="Ver mis visitas" href="/mis-visitas" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 12,
  },
  label: {
    fontSize: 14,
    color: "#999",
  },
  folio: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1A1A1A",
    letterSpacing: 1,
  },
  badge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400E",
  },
  info: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 16,
    lineHeight: 20,
  },
});

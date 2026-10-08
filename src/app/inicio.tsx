import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import NavButton from "../components/NavButton";
import { VisitasService } from "../services/VisitasService";

// Pantalla 2: Inicio. Punto de entrada a las dos acciones principales.
export default function InicioScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await VisitasService.logout();
      router.replace("/");
    } catch {
      Alert.alert("Error", "No se pudo cerrar la sesion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Hola, visitante" subtitle="Que deseas hacer hoy?">
      <NavButton label="Solicitar visita" href="/solicitar-visita" />
      <NavButton label="Mis visitas" href="/mis-visitas" dark={false} />

      <View style={styles.spacer} />

      <Pressable
        onPress={handleLogout}
        disabled={loading}
        style={[styles.logoutButton, loading && styles.logoutDisabled]}
      >
        {loading ? (
          <ActivityIndicator color="#DC2626" />
        ) : (
          <Text style={styles.logoutText}>Cerrar sesion</Text>
        )}
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  spacer: { flex: 1 },
  logoutButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DC2626",
    marginBottom: 32,
  },
  logoutDisabled: { opacity: 0.6 },
  logoutText: { color: "#DC2626", fontWeight: "700", fontSize: 15 },
});

import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, AppState, Pressable, StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import NavButton from "../components/NavButton";
import { VisitasService } from "../services/VisitasService";
import AvisoNotificaciones from "../components/AvisoNotificaciones";
import BannerPermisoDenegado from "../components/BannerPermisoDenegado";
import usePermisoNotificaciones from "../hooks/usePermisoNotificaciones";

// Pantalla 2: Inicio. Punto de entrada a las dos acciones principales.
export default function InicioScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [qrGuardado, setQRGuardado] = useState<number | null>(null);
  const notificaciones = usePermisoNotificaciones();

  useFocusEffect(useCallback(() => {
    let activo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const actualizar = async () => {
      const qr = await VisitasService.obtenerQRGuardado();
      if (!activo) return;
      setQRGuardado(qr?.visita_id ?? null);
      clearTimeout(timer);
      if (qr) timer = setTimeout(() => void actualizar(), Math.min(2147483647, Math.max(1, Date.parse(qr.vigente_hasta) + 1 - Date.now())));
    };
    void actualizar();
    const listener = AppState.addEventListener("change", state => {
      if (state === "active") void actualizar();
    });
    return () => { activo = false; clearTimeout(timer); listener.remove(); };
  }, []));

  const handleLogout = async () => {
    setLoading(true);
    setQRGuardado(null);
    try {
      await VisitasService.logout();
      router.replace("/");
    } catch {
      Alert.alert("Error", "No se pudo cerrar la sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Hola, visitante" subtitle="¿Qué deseas hacer hoy?">
      <AvisoNotificaciones
        visible={notificaciones.mostrarAviso && !loading}
        onAceptar={notificaciones.aceptar}
        onCancelar={notificaciones.cancelar}
      />
      <BannerPermisoDenegado visible={notificaciones.permisoDenegado} />
      <NavButton label="Solicitar visita" href="/solicitar-visita" />
      <NavButton label="Mis visitas" href="/mis-visitas" dark={false} />
      {!loading && qrGuardado !== null && <NavButton label="Ver último QR guardado" href={{ pathname: "/codigo-qr", params: { id: String(qrGuardado) } }} dark={false} />}

      <View style={styles.spacer} />

      <Pressable
        onPress={handleLogout}
        disabled={loading}
        style={[styles.logoutButton, loading && styles.logoutDisabled]}
      >
        {loading ? (
          <ActivityIndicator color="#DC2626" />
        ) : (
          <Text style={styles.logoutText}>Cerrar sesión</Text>
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

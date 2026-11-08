import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

export type EstadoQR = "valido" | "expirado" | "usado";

type EstadoConfig = {
  bg: string;
  text: string;
  label: string;
  mensaje: string;
  icono: string;
  overlay: string;
};

const ESTADO_QR_CONFIG: Record<EstadoQR, EstadoConfig> = {
  valido: {
    bg: "#D1FAE5",
    text: "#065F46",
    label: "Válido",
    mensaje: "Muestra este código en la caseta de vigilancia",
    icono: "✓",
    overlay: "",
  },
  expirado: {
    bg: "#FEE2E2",
    text: "#991B1B",
    label: "Expirado",
    mensaje: "Este código ya no es válido. Solicita una nueva visita.",
    icono: "✕",
    overlay: "Código expirado",
  },
  usado: {
    bg: "#E0E7FF",
    text: "#3730A3",
    label: "Usado",
    mensaje: "Este código ya fue utilizado para ingresar.",
    icono: "⎘",
    overlay: "Código utilizado",
  },
};

const ESTADOS_VALIDOS: EstadoQR[] = ["valido", "expirado", "usado"];

const EJEMPLO_QR = "https://kairos.duckdns.org/visita/KV-000123";

function esEstadoValido(valor: string): valor is EstadoQR {
  return (ESTADOS_VALIDOS as string[]).includes(valor);
}

export default function CodigoQrScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ folio?: string; estado?: string }>();

  const folio = params.folio ?? "KV-000123";
  const estado: EstadoQR =
    params.estado && esEstadoValido(params.estado) ? params.estado : "valido";

  const config = ESTADO_QR_CONFIG[estado];
  const qrDeshabilitado = estado !== "valido";

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Tu codigo de acceso</Text>
        <Text style={styles.subtitle}>{config.mensaje}</Text>

        <View style={styles.badgeContainer}>
          <View style={[styles.badge, { backgroundColor: config.bg }]}>
            <Text style={[styles.badgeText, { color: config.text }]}>
              {config.icono} {config.label}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.qrWrapper,
            qrDeshabilitado && styles.qrDeshabilitado,
          ]}
        >
          <QRCode value={EJEMPLO_QR} size={200} backgroundColor="#FFFFFF" />
          {qrDeshabilitado && (
            <View style={styles.qrOverlay}>
              <Text style={styles.qrOverlayIcon}>
                {estado === "expirado" ? "✕" : "✓"}
              </Text>
              <Text style={styles.qrOverlayText}>{config.overlay}</Text>
            </View>
          )}
        </View>

        <Text style={styles.folio}>Folio {folio}</Text>

        <Pressable style={styles.volverButton} onPress={() => router.back()}>
          <Text style={styles.volverButtonText}>Volver</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scroll: {
    paddingTop: 80,
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#171717",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: "#666666",
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  badgeContainer: {
    marginTop: 16,
  },
  badge: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  qrWrapper: {
    width: 232,
    height: 232,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  qrDeshabilitado: {
    opacity: 0.35,
  },
  qrOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  qrOverlayIcon: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "700",
  },
  qrOverlayText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  folio: {
    fontSize: 14,
    color: "#666666",
    marginTop: 12,
    textAlign: "center",
  },
  volverButton: {
    backgroundColor: "#171717",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 32,
    alignSelf: "stretch",
  },
  volverButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
});

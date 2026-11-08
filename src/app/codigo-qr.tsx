import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { CodigoQR, esIdVisitaValido, SesionExpiradaError, VisitasService } from "../services/VisitasService";

export type EstadoQR = "valido" | "expirado" | "usado" | "anticipado";

type EstadoConfig = {
  bg: string;
  text: string;
  label: string;
  mensaje: string;
  icono: string;
  overlay: string;
};

const ESTADO_QR_CONFIG: Record<EstadoQR, EstadoConfig> = {
  anticipado: { bg: "#FEF3C7", text: "#92400E", label: "Aún no vigente", mensaje: "El código estará disponible al iniciar su ventana de vigencia.", icono: "⎘", overlay: "Aún no vigente" },
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
    label: "Utilizado",
    mensaje: "Este código ya fue utilizado para ingresar.",
    icono: "⎘",
    overlay: "Código utilizado",
  },
};


export default function CodigoQrScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const [datos, setDatos] = useState<CodigoQR | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [bloqueado, setBloqueado] = useState(false);
  const control = useRef<AbortController | null>(null);
  const enfocado = useRef(false);
  const ultimaConsulta = useRef(0);
  const pendiente = useRef(false);
  const vigenteId = esIdVisitaValido(id);

  const cargar = useCallback(async () => {
    if (!enfocado.current || AppState.currentState === "background" || control.current) return;
    if (!esIdVisitaValido(id)) {
      setDatos(null); setError("El identificador de la visita no es válido."); setCargando(false);
      return;
    }
    if (Date.now() - ultimaConsulta.current < 30000) { pendiente.current = true; setBloqueado(true); return; }
    pendiente.current = false;
    ultimaConsulta.current = Date.now();
    setBloqueado(true);
    const solicitud = new AbortController();
    control.current = solicitud;
    setDatos(null); setError(null); setCargando(true);
    const timeout = setTimeout(() => solicitud.abort(), 15000);
    try {
      const qr = await VisitasService.obtenerQR(id, solicitud.signal);
      if (control.current !== solicitud || !enfocado.current) return;
      setAhora(Date.now()); setDatos(qr);
    } catch (err) {
      if (control.current !== solicitud || !enfocado.current) return;
      if (err instanceof SesionExpiradaError) {
        Alert.alert("Sesión expirada", err.message);
        router.replace("/");
      } else {
        setError(err instanceof Error ? err.message : "No se pudo obtener el código QR.");
      }
    } finally {
      clearTimeout(timeout);
      if (control.current === solicitud) { control.current = null; setCargando(false); }
    }
  }, [id, router]);

  useFocusEffect(useCallback(() => {
    enfocado.current = true;
    void cargar();
    const listener = AppState.addEventListener("change", state => {
      setDatos(null);
      if (state === "active") { setAhora(Date.now()); void cargar(); }
      else { control.current?.abort(); control.current = null; }
    });
    return () => {
      enfocado.current = false;
      pendiente.current = false;
      control.current?.abort(); control.current = null;
      setDatos(null);
      listener.remove();
    };
  }, [cargar]));

  useEffect(() => {
    if (!bloqueado) return;
    const timer = setTimeout(() => { setBloqueado(false); if (enfocado.current && pendiente.current) void cargar(); }, Math.max(0, ultimaConsulta.current + 30000 - Date.now()));
    // No sondeo: solo se reconsulta si se perdió el QR al volver del segundo plano.
    return () => clearTimeout(timer);
  }, [bloqueado, cargando, cargar]);

  useEffect(() => {
    if (!datos || datos.estado_qr !== "valido") return;
    const limite = Date.now() < Date.parse(datos.vigente_desde) ? Date.parse(datos.vigente_desde) : Date.parse(datos.vigente_hasta) + 1;
    if (limite <= Date.now()) return;
    const timer = setTimeout(() => {
      setAhora(Date.now());
      if (Date.now() > Date.parse(datos.vigente_hasta)) setDatos(prev => prev ? { ...prev, qr: null } : null);
    }, Math.min(limite - Date.now(), 2147483647));
    return () => clearTimeout(timer);
  }, [datos, ahora]);

  let estado: EstadoQR = datos?.estado_qr ?? "anticipado";
  if (datos && estado === "valido") {
    if (ahora > Date.parse(datos.vigente_hasta)) estado = "expirado";
    else if (ahora < Date.parse(datos.vigente_desde)) estado = "anticipado";
  }
  const config = ESTADO_QR_CONFIG[estado];
  const volver = () => {
    if (vigenteId) router.replace({ pathname: "/detalle-visita/[id]", params: { id } });
    else router.replace("/mis-visitas");
  };

  const qrDeshabilitado = estado !== "valido";
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Tu código de acceso</Text>
        {cargando && <ActivityIndicator style={styles.loading} size="large" color="#171717" />}
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {datos && !cargando && !error && <>
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
          {!qrDeshabilitado && datos.qr && <QRCode value={datos.qr} size={200} backgroundColor="#FFFFFF" quietZone={8} />}
          {qrDeshabilitado && (
            <View style={styles.qrOverlay}>
              <Text style={styles.qrOverlayIcon}>
                {estado === "expirado" ? "✕" : "✓"}
              </Text>
              <Text style={styles.qrOverlayText}>{config.overlay}</Text>
            </View>
          )}
        </View>

        <Text style={styles.folio}>Folio {datos.folio}</Text>

        <Text style={styles.subtitle}>Vigencia: {new Date(datos.vigente_desde).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })} – {new Date(datos.vigente_hasta).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })} (hora de Ciudad de México)</Text>
        </>}
        {vigenteId && <Pressable accessibilityRole="button" accessibilityLabel={error ? "Reintentar" : "Actualizar estado"} disabled={cargando || bloqueado} style={[styles.volverButton, (cargando || bloqueado) && styles.disabled]} onPress={() => void cargar()}>
          <Text style={styles.volverButtonText}>{error ? "Reintentar" : "Actualizar estado"}</Text>
        </Pressable>}
        {bloqueado && !cargando && <Text style={styles.subtitle}>Podrás actualizar nuevamente en unos segundos.</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" style={styles.volverButton} onPress={volver}>
          <Text style={styles.volverButtonText}>Volver</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginVertical: 48 },
  error: { color: "#991B1B", textAlign: "center", marginVertical: 24 },
  disabled: { opacity: 0.5 },
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

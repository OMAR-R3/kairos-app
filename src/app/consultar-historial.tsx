import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Campo from "../components/Campo";
import Screen from "../components/Screen";
import {
  CodigoInvalidoError,
  DemasiadosIntentosError,
  LookupService,
  SesionLookupExpiradaError,
} from "../services/LookupService";
import type { Visita } from "../services/VisitasService";

type Paso = "correo" | "codigo" | "historial";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ESTADO_CONFIG: Record<
  string,
  { bg: string; text: string; border: string; label: string }
> = {
  aprobada: {
    bg: "#D1FAE5",
    text: "#065F46",
    border: "#10B981",
    label: "Aprobada",
  },
  pendiente: {
    bg: "#FEF3C7",
    text: "#92400E",
    border: "#F59E0B",
    label: "Pendiente",
  },
  rechazada: {
    bg: "#FEE2E2",
    text: "#991B1B",
    border: "#EF4444",
    label: "Rechazada",
  },
  cancelada: {
    bg: "#FEE2E2",
    text: "#991B1B",
    border: "#EF4444",
    label: "Cancelada",
  },
  finalizada: {
    bg: "#E0E7FF",
    text: "#3730A3",
    border: "#6366F1",
    label: "Finalizada",
  },
};

const ESTADO_DEFAULT = {
  bg: "#F3F4F6",
  text: "#374151",
  border: "#9CA3AF",
  label: "Desconocido",
};

function formatearFecha(fechaISO: string): string {
  const [anio, mes, dia] = fechaISO.split("T")[0].split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatearTiempo(segundos: number): string {
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return `${min}:${String(seg).padStart(2, "0")}`;
}

function VisitaCard({ visita }: { visita: Visita }) {
  const config = ESTADO_CONFIG[visita.estado] ?? ESTADO_DEFAULT;
  const depto = visita.departamento?.nombre ?? "Departamento desconocido";

  return (
    <View style={[styles.card, { borderLeftColor: config.border }]}>
      <Text style={styles.departamento}>{depto}</Text>
      <Text style={styles.fecha}>{formatearFecha(visita.fecha)}</Text>
      <Text style={styles.hora}>{visita.hora_inicio}</Text>
      {visita.motivo ? (
        <Text style={styles.motivo}>{visita.motivo}</Text>
      ) : null}
      <View style={[styles.badge, { backgroundColor: config.bg }]}>
        <Text style={[styles.badgeText, { color: config.text }]}>
          {config.label}
        </Text>
      </View>
    </View>
  );
}

function ListaVacia() {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        No se encontraron visitas para este correo
      </Text>
    </View>
  );
}

export default function ConsultarHistorialScreen() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>("correo");
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [tiempoRestante, setTiempoRestante] = useState(0);
  const [reenviando, setReenviando] = useState(false);

  useEffect(() => {
    LookupService.limpiar();
  }, []);

  // Temporizador de sesion (15 min)
  useEffect(() => {
    if (paso !== "historial") return;
    const tick = () => {
      const restante = LookupService.tiempoRestante();
      setTiempoRestante(restante);
      if (restante <= 0) {
        LookupService.limpiar();
        setPaso("correo");
        setCodigo("");
        setVisitas([]);
        Alert.alert(
          "Sesion expirada",
          "Tu sesion de consulta expiro. Solicita un nuevo codigo.",
        );
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [paso]);

  const handleSolicitarCodigo = async () => {
    const correoNorm = correo.trim().toLowerCase();
    if (!correoNorm) {
      setError("Ingresa tu correo electronico");
      return;
    }
    if (!EMAIL_REGEX.test(correoNorm)) {
      setError("El correo no tiene un formato valido");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await LookupService.solicitarCodigo(correoNorm);
      setCorreo(correoNorm);
      setCodigo("");
      setPaso("codigo");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo enviar el codigo",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerificarCodigo = async () => {
    const codigoLimpio = codigo.trim();
    if (!codigoLimpio) {
      setError("Ingresa el codigo de verificacion");
      return;
    }
    if (codigoLimpio.length !== 8 || !/^\d{8}$/.test(codigoLimpio)) {
      setError("El codigo debe tener exactamente 8 digitos");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await LookupService.verificarCodigo(codigoLimpio);
      const historial = await LookupService.obtenerHistorial();
      setVisitas(historial);
      setPaso("historial");
    } catch (err) {
      if (err instanceof SesionLookupExpiradaError) {
        setPaso("correo");
        setCodigo("");
        Alert.alert("Sesion expirada", err.message);
      } else {
        setError(
          err instanceof Error ? err.message : "Error al verificar el codigo",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReenviarCodigo = async () => {
    setReenviando(true);
    setError(null);
    try {
      await LookupService.solicitarCodigo(correo);
      setCodigo("");
      Alert.alert(
        "Codigo reenviado",
        `Enviamos un nuevo codigo a ${correo}`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo reenviar el codigo",
      );
    } finally {
      setReenviando(false);
    }
  };

  const handleCerrarConsulta = async () => {
    setLoading(true);
    try {
      await LookupService.cerrarSesion();
    } finally {
      setLoading(false);
      router.back();
    }
  };

  const handleVolver = () => {
    LookupService.limpiar();
    router.back();
  };

  const handleCambiarCorreo = () => {
    LookupService.limpiar();
    setCodigo("");
    setError(null);
    setPaso("correo");
  };

  // ── Paso 1: Correo ─────────────────────────────────────────────────
  if (paso === "correo") {
    return (
      <Screen
        title="Consultar historial"
        subtitle="Ingresa tu correo para recibir un codigo de verificacion"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scroll}
          >
            <Campo
              label="Correo electronico"
              value={correo}
              onChangeText={(t) => {
                setCorreo(t);
                if (error) setError(null);
              }}
              keyboardType="email-address"
              placeholder="tu@correo.com"
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              onPress={handleSolicitarCodigo}
              disabled={loading}
              style={[styles.button, loading && styles.buttonDisabled]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Enviar codigo</Text>
              )}
            </Pressable>

            <Pressable onPress={handleVolver} style={styles.linkButton}>
              <Text style={styles.linkText}>Volver al inicio</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  // ── Paso 2: Codigo de verificacion ──────────────────────────────────
  if (paso === "codigo") {
    return (
      <Screen
        title="Codigo de verificacion"
        subtitle={`Enviamos un codigo de 8 digitos a ${correo}`}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scroll}
          >
            <Campo
              label="Codigo de verificacion"
              value={codigo}
              onChangeText={(t) => {
                setCodigo(t.replace(/\D/g, ""));
                if (error) setError(null);
              }}
              keyboardType="number-pad"
              maxLength={8}
              placeholder="12345678"
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              onPress={handleVerificarCodigo}
              disabled={loading}
              style={[styles.button, loading && styles.buttonDisabled]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Verificar codigo</Text>
              )}
            </Pressable>

            <Pressable
              onPress={handleReenviarCodigo}
              disabled={reenviando || loading}
              style={styles.linkButton}
            >
              {reenviando ? (
                <ActivityIndicator size="small" color="#171717" />
              ) : (
                <Text style={styles.linkText}>Reenviar codigo</Text>
              )}
            </Pressable>

            <Pressable
              onPress={handleCambiarCorreo}
              disabled={loading}
              style={styles.linkButton}
            >
              <Text style={styles.linkTextSecondary}>Cambiar correo</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  // ── Paso 3: Historial ───────────────────────────────────────────────
  return (
    <Screen title="Tu historial" subtitle={`Visitas de ${correo}`}>
      <View
        style={[
          styles.timerBadge,
          tiempoRestante < 60 && styles.timerBadgeUrgent,
        ]}
      >
        <Text
          style={[
            styles.timerText,
            tiempoRestante < 60 && styles.timerTextUrgent,
          ]}
        >
          Sesion valida: {formatearTiempo(tiempoRestante)}
        </Text>
      </View>

      <FlatList
        data={visitas}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <VisitaCard visita={item} />}
        ListEmptyComponent={ListaVacia}
        contentContainerStyle={
          visitas.length === 0 ? styles.emptyList : styles.list
        }
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      />

      <Pressable
        onPress={handleCerrarConsulta}
        disabled={loading}
        style={[styles.closeButton, loading && styles.buttonDisabled]}
      >
        {loading ? (
          <ActivityIndicator color="#DC2626" />
        ) : (
          <Text style={styles.closeButtonText}>Cerrar consulta</Text>
        )}
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 12, paddingBottom: 32 },
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#171717",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  linkButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  linkText: {
    color: "#171717",
    fontWeight: "600",
    fontSize: 14,
  },
  linkTextSecondary: {
    color: "#666666",
    fontWeight: "500",
    fontSize: 14,
  },
  errorText: {
    color: "#C62828",
    fontSize: 13,
    textAlign: "center",
  },
  // ── Timer ──
  timerBadge: {
    alignSelf: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  timerBadgeUrgent: {
    backgroundColor: "#FEE2E2",
  },
  timerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#92400E",
  },
  timerTextUrgent: {
    color: "#991B1B",
  },
  // ── Cards ──
  list: {
    gap: 12,
    paddingBottom: 16,
  },
  emptyList: {
    flex: 1,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  departamento: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  fecha: {
    fontSize: 13,
    color: "#666666",
    marginTop: 4,
  },
  hora: {
    fontSize: 13,
    color: "#666666",
    marginTop: 2,
  },
  motivo: {
    fontSize: 13,
    color: "#999999",
    marginTop: 2,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    color: "#999999",
    textAlign: "center",
  },
  // ── Close button ──
  closeButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DC2626",
    marginBottom: 16,
  },
  closeButtonText: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 15,
  },
});

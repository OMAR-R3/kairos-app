import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Departamento,
  SesionExpiradaError,
  Visita,
  VisitasService,
} from "../../services/VisitasService";

const ESTADO_CONFIG: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  aprobada: { bg: "#D1FAE5", text: "#065F46", label: "Aprobada" },
  pendiente: { bg: "#FEF3C7", text: "#92400E", label: "Pendiente" },
  rechazada: { bg: "#FEE2E2", text: "#991B1B", label: "Rechazada" },
  cancelada: { bg: "#FEE2E2", text: "#991B1B", label: "Cancelada" },
  finalizada: { bg: "#E0E7FF", text: "#3730A3", label: "Finalizada" },
};

const ESTADO_DEFAULT = { bg: "#F3F4F6", text: "#374151", label: "Desconocido" };

function formatearFecha(fechaISO: string): string {
  const [anio, mes, dia] = fechaISO.split("T")[0].split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatearHora(hora: string): string {
  return hora.slice(0, 5);
}

type CampoInfoProps = {
  label: string;
  value: string;
};

function CampoInfo({ label, value }: CampoInfoProps) {
  return (
    <View style={styles.campo}>
      <Text style={styles.campoLabel}>{label}</Text>
      <Text style={styles.campoValue}>{value}</Text>
    </View>
  );
}

export default function DetalleVisitaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [visita, setVisita] = useState<Visita | null>(null);
  const [nombreDepto, setNombreDepto] = useState("");
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [historial, departamentos] = await Promise.all([
          VisitasService.obtenerHistorial(),
          VisitasService.obtenerDepartamentos(),
        ]);

        const encontrada = historial.find((v) => String(v.id) === id);
        if (!encontrada) {
          Alert.alert("Error", "No se encontro la visita");
          router.back();
          return;
        }

        const mapa: Record<string, string> = {};
        departamentos.forEach((d: Departamento) => {
          mapa[String(d.id)] = d.nombre;
        });

        setVisita(encontrada);
        setNombreDepto(
          encontrada.departamento?.nombre ??
            mapa[String(encontrada.depto_id)] ??
            "Departamento desconocido"
        );
      } catch (err) {
        if (err instanceof SesionExpiradaError) {
          Alert.alert("Sesion expirada", err.message);
          router.replace("/");
          return;
        }
        Alert.alert(
          "Error",
          err instanceof Error ? err.message : "No se pudo cargar la visita"
        );
        router.back();
      } finally {
        setCargando(false);
      }
    })();
  }, [id]);

  if (cargando) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0D9488" />
        </View>
      </View>
    );
  }

  if (!visita) return null;

  const config = ESTADO_CONFIG[visita.estado] ?? ESTADO_DEFAULT;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Detalle de visita</Text>

        <View style={styles.badgeContainer}>
          <View style={[styles.badge, { backgroundColor: config.bg }]}>
            <Text style={[styles.badgeText, { color: config.text }]}>
              {config.label}
            </Text>
          </View>
        </View>

        <View style={styles.separator} />

        <CampoInfo label="Persona a visitar" value={nombreDepto} />
        <CampoInfo label="Fecha" value={formatearFecha(visita.fecha)} />
        <CampoInfo label="Hora" value={formatearHora(visita.hora_inicio)} />
        <CampoInfo
          label="Motivo"
          value={visita.motivo || "Sin motivo especificado"}
        />
        <Pressable style={styles.qrButton} onPress={() => {}}>
          <Text style={styles.qrButtonText}>Ver codigo QR</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: {
    paddingTop: 80,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111111",
    textAlign: "center",
  },
  badgeContainer: {
    alignItems: "center",
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
  separator: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginTop: 24,
    marginBottom: 8,
  },
  campo: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  campoLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 4,
  },
  campoValue: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1A1A1A",
  },
  qrButton: {
    backgroundColor: "#171717",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
  },
  qrButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
});

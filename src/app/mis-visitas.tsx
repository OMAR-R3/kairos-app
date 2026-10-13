import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import Screen from "../components/Screen";
import {
  Departamento,
  SesionExpiradaError,
  Visita,
  VisitasService,
} from "../services/VisitasService";

const ESTADO_CONFIG: Record<
  string,
  { bg: string; text: string; border: string; label: string }
> = {
  aprobada: { bg: "#D1FAE5", text: "#065F46", border: "#10B981", label: "Aprobada" },
  pendiente: { bg: "#FEF3C7", text: "#92400E", border: "#F59E0B", label: "Pendiente" },
  rechazada: { bg: "#FEE2E2", text: "#991B1B", border: "#EF4444", label: "Rechazada" },
  cancelada: { bg: "#FEE2E2", text: "#991B1B", border: "#EF4444", label: "Cancelada" },
  finalizada: { bg: "#E0E7FF", text: "#3730A3", border: "#6366F1", label: "Finalizada" },
};

const ESTADO_DEFAULT = { bg: "#F3F4F6", text: "#374151", border: "#9CA3AF", label: "Desconocido" };

function formatearFecha(fechaISO: string): string {
  const [anio, mes, dia] = fechaISO.split("T")[0].split("-");
  return `${dia}/${mes}/${anio}`;
}

function VisitaCard({
  visita,
  departamento,
}: {
  visita: Visita;
  departamento: string;
}) {
  const config = ESTADO_CONFIG[visita.estado] ?? ESTADO_DEFAULT;

  return (
    <View style={[styles.card, { borderLeftColor: config.border }]}>
      <Text style={styles.departamento}>{departamento}</Text>
      <Text style={styles.fecha}>{formatearFecha(visita.fecha)}</Text>
      <Text style={styles.hora}>{visita.hora_inicio}</Text>
      {visita.motivo ? <Text style={styles.motivo}>{visita.motivo}</Text> : null}
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
      <Text style={styles.emptyText}>Aun no tienes visitas</Text>
    </View>
  );
}

function getNombreDepto(visita: Visita, mapa: Record<string, string>): string {
  if (visita.departamento?.nombre) return visita.departamento.nombre;
  return mapa[String(visita.depto_id)] ?? "Departamento desconocido";
}

export default function MisVisitasScreen() {
  const router = useRouter();
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [deptos, setDeptos] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      const [listaVisitas, listaDepartamentos] = await Promise.all([
        VisitasService.obtenerHistorial(),
        VisitasService.obtenerDepartamentos(),
      ]);

      const mapa: Record<string, string> = {};
      listaDepartamentos.forEach((d: Departamento) => {
        mapa[String(d.id)] = d.nombre;
      });

      setDeptos(mapa);
      setVisitas(listaVisitas);
    } catch (err) {
      if (err instanceof SesionExpiradaError) {
        Alert.alert("Sesion expirada", err.message);
        router.replace("/");
        return;
      }
      Alert.alert("Error", err instanceof Error ? err.message : "No se pudieron cargar las visitas");
    } finally {
      setCargando(false);
    }
  }, [router]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  if (cargando) {
    return (
      <Screen title="Mis visitas" subtitle="Historial y estado de tus solicitudes">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#171717" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Mis visitas" subtitle="Historial y estado de tus solicitudes">
      <FlatList
        data={visitas}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <VisitaCard
            visita={item}
            departamento={getNombreDepto(item, deptos)}
          />
        )}
        ListEmptyComponent={ListaVacia}
        contentContainerStyle={visitas.length === 0 ? styles.emptyList : styles.list}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
    paddingBottom: 32,
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    color: "#999999",
  },
});

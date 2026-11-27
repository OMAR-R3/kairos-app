import * as SecureStore from "expo-secure-store";
import type { Visita } from "./VisitasService";

const CACHE_KEY = "kairos_historial_visitas";
const opciones = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

let cola: Promise<unknown> = Promise.resolve();

// La limpieza espera cualquier escritura ya iniciada. Las operaciones que
// sigan en cola comprueban si la sesión que las inició continúa activa.
function enCola<T>(operacion: () => Promise<T>): Promise<T> {
  const resultado = cola.then(operacion);
  cola = resultado.catch(() => undefined);
  return resultado;
}

function esId(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isSafeInteger(valor) && valor > 0;
}

function esVisita(valor: unknown): valor is Visita {
  if (!valor || typeof valor !== "object") return false;
  const visita = valor as Partial<Visita>;
  const departamento = visita.departamento;
  return esId(visita.id) &&
    (esId(visita.depto_id) || (departamento != null && esId(departamento.id))) &&
    typeof visita.fecha === "string" &&
    /^\d{4}-\d{2}-\d{2}(?:T.+)?$/.test(visita.fecha) &&
    Number.isFinite(Date.parse(visita.fecha)) &&
    typeof visita.hora_inicio === "string" &&
    /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/.test(visita.hora_inicio) &&
    typeof visita.motivo === "string" &&
    typeof visita.estado === "string" &&
    ["pendiente", "aprobada", "rechazada", "cancelada", "finalizada"].includes(visita.estado) &&
    (departamento == null || (esId(departamento.id) && typeof departamento.nombre === "string"));
}

export function esListaDeVisitas(valor: unknown): valor is Visita[] {
  return Array.isArray(valor) && valor.every(esVisita);
}

export const HistorialCacheService = {
  limpiar(): Promise<void> {
    return enCola(() => SecureStore.deleteItemAsync(CACHE_KEY, opciones));
  },

  guardar(visitas: Visita[], titular: string, sesionActiva: () => boolean): Promise<void> {
    return enCola(async () => {
      if (!sesionActiva()) return;
      const lista = visitas.map(({ id, depto_id, fecha, hora_inicio, motivo, estado, departamento }) => ({
        id, depto_id, fecha, hora_inicio, motivo, estado,
        departamento: departamento && { id: departamento.id, nombre: departamento.nombre },
      }));
      await SecureStore.setItemAsync(CACHE_KEY, JSON.stringify({ version: 1, titular, visitas: lista }), opciones);
    });
  },

  leer(titular: string, sesionActiva: () => boolean): Promise<Visita[] | null> {
    return enCola(async () => {
      if (!sesionActiva()) return null;
      const raw = await SecureStore.getItemAsync(CACHE_KEY, opciones);
      if (!raw || !sesionActiva()) return null;
      let registro: { version?: unknown; titular?: unknown; visitas?: unknown } | null;
      try {
        registro = JSON.parse(raw);
      } catch {
        return null;
      }
      return registro?.version === 1 && registro.titular === titular && esListaDeVisitas(registro.visitas)
        ? registro.visitas
        : null;
    });
  },
};

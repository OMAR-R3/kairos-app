import * as SecureStore from "expo-secure-store";
import type { CodigoQR } from "./VisitasService";

const CACHE_KEY = "kairos_ultimo_qr";
const SESSION_KEY = "kairos_qr_sesion";

export type QRGuardado = CodigoQR & { ultima_comprobacion: number };
type Registro = {
  version: 1;
  sesion: string;
  visita_id: number;
  folio: string;
  qr: string;
  vigente_desde: string;
  vigente_hasta: string;
  ultima_comprobacion: number;
};

let generacion = 0;
let bloqueada = false;
let cola: Promise<unknown> = Promise.resolve();
function enCola<T>(operacion: () => Promise<T>): Promise<T> {
  const resultado = cola.then(operacion);
  cola = resultado.catch(() => undefined);
  return resultado;
}

function registroValido(valor: unknown): valor is Registro {
  if (!valor || typeof valor !== "object") return false;
  const r = valor as Registro;
  const fecha = (s: unknown): s is string => typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(s) &&
    Number.isFinite(Date.parse(s)) && new Date(s).toISOString() === s.replace(/Z$/, s.includes(".") ? "Z" : ".000Z");
  return r.version === 1 && typeof r.sesion === "string" && !!r.sesion &&
    Number.isSafeInteger(r.visita_id) && r.visita_id > 0 &&
    typeof r.folio === "string" && !!r.folio.trim() && typeof r.qr === "string" && !!r.qr.trim() &&
    fecha(r.vigente_desde) && fecha(r.vigente_hasta) &&
    Date.parse(r.vigente_desde) < Date.parse(r.vigente_hasta) &&
    Number.isFinite(r.ultima_comprobacion) && r.ultima_comprobacion > 0;
}

// Todas las operaciones de disco se serializan. Revocar es síncrono: las
// peticiones anteriores no pueden escribir después de cambiar de sesión.
export const QRCacheService = {
  generacion: () => generacion,
  revocar() { bloqueada = true; generacion += 1; },
  habilitar() { bloqueada = false; },

  limpiar(): Promise<void> {
    return enCola(async () => {
      const resultados = await Promise.allSettled([
        SecureStore.deleteItemAsync(SESSION_KEY), SecureStore.deleteItemAsync(CACHE_KEY),
      ]);
      if (resultados.some(r => r.status === "rejected")) {
        throw new Error("No se pudieron eliminar todos los datos locales del QR. Inténtalo de nuevo.");
      }
    });
  },

  guardar(qr: CodigoQR, origen: number): Promise<void> {
    return enCola(async () => {
      if (bloqueada || origen !== generacion || qr.estado_qr !== "valido" || !qr.qr) return;
      let sesion = await SecureStore.getItemAsync(SESSION_KEY);
      if (!sesion) {
        // Identificador local opaco, no es una credencial ni sustituye al JWT.
        sesion = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
        await SecureStore.setItemAsync(SESSION_KEY, sesion);
      }
      const registro: Registro = {
        version: 1, sesion, visita_id: qr.visita_id, folio: qr.folio, qr: qr.qr,
        vigente_desde: qr.vigente_desde, vigente_hasta: qr.vigente_hasta,
        ultima_comprobacion: Date.now(),
      };
      if (!registroValido(registro) || Date.now() > Date.parse(qr.vigente_hasta)) return;
      if (bloqueada || origen !== generacion) return;
      await SecureStore.setItemAsync(CACHE_KEY, JSON.stringify(registro));
    });
  },

  leer(origen: number, visita?: string): Promise<QRGuardado | null> {
    return enCola(async () => {
      if (bloqueada || origen !== generacion) return null;
      const sesion = await SecureStore.getItemAsync(SESSION_KEY);
      const raw = await SecureStore.getItemAsync(CACHE_KEY);
      if (!sesion || !raw || bloqueada || origen !== generacion) return null;
      let r: unknown;
      try { r = JSON.parse(raw); } catch { return null; }
      if (!registroValido(r) || r.sesion !== sesion) return null;
      if (Date.now() > Date.parse(r.vigente_hasta)) {
        await SecureStore.deleteItemAsync(CACHE_KEY);
        return null;
      }
      // Un retroceso del reloj no debe extender la validez de una copia.
      if (Date.now() < r.ultima_comprobacion || (visita && r.visita_id !== Number(visita))) return null;
      return {
        visita_id: r.visita_id, folio: r.folio, qr: r.qr, estado_qr: "valido",
        vigente_desde: r.vigente_desde, vigente_hasta: r.vigente_hasta,
        ultima_comprobacion: r.ultima_comprobacion,
      };
    });
  },

  eliminarVisita(visita: string, origen: number): Promise<void> {
    return enCola(async () => {
      if (bloqueada || origen !== generacion) return;
      try {
        const raw = await SecureStore.getItemAsync(CACHE_KEY);
        if (!raw) return;
        let registro: unknown;
        try { registro = JSON.parse(raw); } catch { registro = null; }
        if (!registroValido(registro) || registro.visita_id === Number(visita)) {
          await SecureStore.deleteItemAsync(CACHE_KEY);
        }
      } catch (error) {
        // También invalidar si no se pudo leer qué visita estaba guardada.
        bloqueada = true;
        await SecureStore.deleteItemAsync(SESSION_KEY);
        throw error;
      }
    });
  },
};

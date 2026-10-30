// Facade: único punto por el que la app habla con la API de Kairos (Next.js).
// La app nunca habla directo con Supabase.

import * as SecureStore from "expo-secure-store";
import { NotificacionesService } from "./NotificacionesService";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const TOKEN_KEY = "kairos_visitante_token";
let generacionSesion = 0;
let cerrandoSesion = false;
let registroPush: string | null = null;
let colaPush: Promise<unknown> = Promise.resolve();

// Las escrituras de sesión esperan a las peticiones push en curso. Nunca se
// guarda un JWT en la cola: cada petición lo lee de SecureStore al ejecutarse.
function enColaPush<T>(operacion: () => Promise<T>): Promise<T> {
  const resultado = colaPush.then(operacion);
  colaPush = resultado.catch(() => undefined);
  return resultado;
}

export type DatosRegistro = {
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  correo: string;
  telefono: string;
  password: string;
};

export type DatosLogin = {
  correo: string;
  password: string;
};

export type Visitante = {
  id: number;
  nombre: string;
  correo: string;
  dispositivo: string;
};

export type Departamento = {
  id: number;
  nombre: string;
  ubicacion: string;
};

export type DatosVisita = {
  depto_id: number;
  fecha: string; // "YYYY-MM-DD"
  hora_inicio: string; // "HH:mm:ss"
  motivo: string;
};

export type Visita = {
  id: number;
  depto_id: number;
  fecha: string;
  hora_inicio: string;
  motivo: string;
  estado: "pendiente" | "aprobada" | "rechazada" | "cancelada" | "finalizada";
  departamento?: { id: number; nombre: string };
};

export class SesionExpiradaError extends Error {
  constructor() {
    super("Tu sesión expiró, inicia sesión de nuevo");
    this.name = "SesionExpiradaError";
  }
}

export type DetalleVisita = Pick<
  Visita,
  "id" | "estado" | "fecha" | "hora_inicio" | "motivo"
> & {
  folio: string;
  departamento: Departamento | null;
};

export class VisitaNoEncontradaError extends Error {
  constructor() {
    super("No se encontró la visita solicitada.");
    this.name = "VisitaNoEncontradaError";
  }
}

export const generarFolio = (id: number) => `KV-${String(id).padStart(6, "0")}`;

// Revisa la fecha de expiración del JWT sin llamar al servidor.
function tokenVigente(token: string): boolean {
  try {
    const parte = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const relleno = parte + "=".repeat((4 - (parte.length % 4)) % 4);
    const payload = JSON.parse(atob(relleno));
    return !payload.exp || payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

async function peticionAutenticada(
  ruta: string,
  opciones: {
    method?: "GET" | "POST" | "DELETE";
    body?: unknown;
    conservarSesion?: boolean;
    signal?: AbortSignal;
  } = {}
): Promise<Response> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${ruta}`, {
      method: opciones.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opciones.body ? JSON.stringify(opciones.body) : undefined,
      signal: opciones.signal,
    });
  } catch {
    throw new Error("No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.");
  }

  if (res.status === 401 && !opciones.conservarSesion) {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    throw new SesionExpiradaError();
  }
  return res;
}

async function enviarTokenPush(
  method: "POST" | "DELETE",
  token: string,
  plataforma?: "android" | "ios",
): Promise<void> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), 8000);
  try {
    const res = await peticionAutenticada("/api/visitants/me/push-token", {
      method,
      body: method === "POST" ? { token, plataforma } : { token },
      conservarSesion: true,
      signal: controlador.signal,
    });
    if (!res.ok) throw new Error("No se pudo sincronizar el token de notificaciones");
  } finally {
    clearTimeout(temporizador);
  }
}

export const VisitasService = {
  // TODO: agendarVisita(), obtenerVisitas(), obtenerQR()...

  async registrarVisitante(datos: DatosRegistro): Promise<void> {
    const res = await fetch(`${API_URL}/api/auth/visitante-registro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });

    if (res.status === 409) throw new Error("Ya existe una cuenta con ese correo");
    if (res.status === 429) throw new Error("Demasiados intentos, intenta más tarde");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "No se pudo crear la cuenta");
    }
  },

  async login(datos: DatosLogin): Promise<Visitante> {
    const res = await fetch(`${API_URL}/api/auth/visitante-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });

    if (res.status === 401) throw new Error("Correo o contraseña incorrectos");
    if (res.status === 429) throw new Error("Demasiados intentos, intenta más tarde");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "No se pudo iniciar sesión");
    }

    const { token, visitante } = await res.json();
    generacionSesion += 1;
    await enColaPush(async () => {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      registroPush = null;
      cerrandoSesion = false;
    });
    return visitante;
  },

  async obtenerDepartamentos(): Promise<Departamento[]> {
    const res = await peticionAutenticada("/api/department");

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "No se pudieron cargar los departamentos");
    }

    const body = await res.json();
    return body.data ?? body;
  },

  async agendarVisita(datos: DatosVisita): Promise<{ visita: Visita; folio: string }> {
    // visitante_id no se manda, el backend lo toma del token
    const res = await peticionAutenticada("/api/visits/me", {
      method: "POST",
      body: datos,
    });

    if (res.status === 409) throw new Error("Ya tienes una visita registrada con esos datos");
    if (res.status === 429) throw new Error("Demasiados intentos, intenta más tarde");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "No se pudo agendar la visita");
    }

    const body = await res.json();
    const visita: Visita = body.data ?? body;
    return { visita, folio: generarFolio(visita.id) };
  },

  async obtenerMisVisitas(): Promise<Visita[]> {
    const res = await peticionAutenticada("/api/visits/me");

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "No se pudieron cargar las visitas");
    }

    const body = await res.json();
    const visitas = body.data ?? body;
    return Array.isArray(visitas) ? visitas : [];
  },

  async obtenerDetalleVisita(id: string): Promise<DetalleVisita> {
    if (typeof id !== "string" || !/^\d+$/.test(id) || !/[1-9]/.test(id)) {
      throw new Error("El identificador de la visita no es válido.");
    }

    const res = await peticionAutenticada(`/api/visits/me/${encodeURIComponent(id)}`);
    if (res.status === 404) throw new VisitaNoEncontradaError();
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "No fue posible cargar los detalles de la visita. Inténtalo de nuevo.");
    }

    const body: { success: boolean; data: DetalleVisita | null } = await res.json();
    if (!body.success || !body.data) {
      throw new Error("No fue posible cargar los detalles de la visita. Inténtalo de nuevo.");
    }
    return body.data;
  },

  async logout(): Promise<void> {
    cerrandoSesion = true;
    generacionSesion += 1;
    await enColaPush(async () => {
      try {
        const token = await NotificacionesService.tokenGuardado();
        if (token) await enviarTokenPush("DELETE", token);
      } catch {
        // Push es opcional; no se retiene el JWT para reintentar.
      } finally {
        registroPush = null;
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
    });
  },

  generacionSesionPush: () => generacionSesion,

  async registrarTokenPush(
    token: string,
    plataforma: "android" | "ios",
    generacion: number,
  ): Promise<void> {
    await enColaPush(async () => {
      if (cerrandoSesion || generacion !== generacionSesion) return;
      const jwt = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!jwt || !tokenVigente(jwt) || generacion !== generacionSesion) return;
      if (registroPush === token) return;
      // Se conserva antes del POST para poder limpiar un registro cuya
      // respuesta se perdió por un fallo de conexión.
      await NotificacionesService.guardarToken(token);
      if (cerrandoSesion || generacion !== generacionSesion) return;
      await enviarTokenPush("POST", token, plataforma);
      registroPush = token;
    });
  },

  async eliminarTokenPush(token: string, generacion: number): Promise<void> {
    await enColaPush(async () => {
      if (cerrandoSesion || generacion !== generacionSesion) return;
      if (!(await SecureStore.getItemAsync(TOKEN_KEY))) return;
      await enviarTokenPush("DELETE", token);
      registroPush = null;
      await NotificacionesService.olvidarToken();
    });
  },

  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  // true si hay un token guardado y todavía no expira
  async obtenerDatosSesion(): Promise<Record<string, unknown> | null> {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) return null;
      const parte = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const relleno = parte + "=".repeat((4 - (parte.length % 4)) % 4);
      return JSON.parse(atob(relleno));
    } catch {
      return null;
    }
  },

  async restaurarSesion(): Promise<boolean> {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) return false;
      if (!tokenVigente(token)) {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  },
};

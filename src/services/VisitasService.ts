// Facade: unico punto por el que la app habla con la API de Kairos (Next.js).
// La app nunca habla directo con Supabase.

import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const TOKEN_KEY = "kairos_visitante_token";

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
  estado: "pendiente" | "aprobada" | "cancelada" | "finalizada";
};

export class SesionExpiradaError extends Error {
  constructor() {
    super("Tu sesion expiro, inicia sesion de nuevo");
    this.name = "SesionExpiradaError";
  }
}

export const generarFolio = (id: number) => `KV-${String(id).padStart(6, "0")}`;

// Revisa la fecha de expiracion del JWT sin llamar al servidor.
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
  opciones: { method?: "GET" | "POST"; body?: unknown } = {}
): Promise<Response> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);

  const res = await fetch(`${API_URL}${ruta}`, {
    method: opciones.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });

  if (res.status === 401) {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    throw new SesionExpiradaError();
  }
  return res;
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
    if (res.status === 429) throw new Error("Demasiados intentos, intenta mas tarde");
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

    if (res.status === 401) throw new Error("Correo o contrasena incorrectos");
    if (res.status === 429) throw new Error("Demasiados intentos, intenta mas tarde");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "No se pudo iniciar sesion");
    }

    const { token, visitante } = await res.json();
    await SecureStore.setItemAsync(TOKEN_KEY, token);
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
    if (res.status === 429) throw new Error("Demasiados intentos, intenta mas tarde");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "No se pudo agendar la visita");
    }

    const body = await res.json();
    const visita: Visita = body.data ?? body;
    return { visita, folio: generarFolio(visita.id) };
  },

  async logout(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },

  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  // true si hay un token guardado y todavia no expira
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
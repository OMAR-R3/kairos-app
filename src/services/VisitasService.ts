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

export type DatosVisita = {
  motivo: string;
  area: string;
  fecha: string;
};

export type Visita = {
  id: number;
  folio: string;
  motivo: string;
  area: string;
  fecha: string;
  estado: string;
};

export const VisitasService = {
  async agendarVisita(datos: DatosVisita): Promise<Visita> {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const res = await fetch(`${API_URL}/api/visitas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(datos),
    });

    if (res.status === 401) throw new Error("Sesion expirada, inicia sesion de nuevo");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "No se pudo agendar la visita");
    }
    return res.json();
  },

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

  async logout(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },

  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
};
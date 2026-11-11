// Servicio para el flujo lookup: verificar identidad por correo para
// consultar historial de visitas sin iniciar sesion.
// challengeId, browserSecret y accessToken viven solo en memoria.

import type { Visita } from "./VisitasService";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

type Challenge = {
  challengeId: string;
  browserSecret: string;
  correo: string;
};

type Session = {
  accessToken: string;
  correo: string;
  expiresAt: number;
};

let challenge: Challenge | null = null;
let session: Session | null = null;

export class CodigoInvalidoError extends Error {
  constructor(mensaje?: string) {
    super(mensaje ?? "El codigo es incorrecto o ya vencio");
    this.name = "CodigoInvalidoError";
  }
}

export class DemasiadosIntentosError extends Error {
  constructor() {
    super("Demasiados intentos. Espera un momento antes de volver a intentar.");
    this.name = "DemasiadosIntentosError";
  }
}

export class SesionLookupExpiradaError extends Error {
  constructor() {
    super("Tu sesion de consulta expiro. Solicita un nuevo codigo.");
    this.name = "SesionLookupExpiradaError";
  }
}

async function fetchJSON(
  ruta: string,
  opciones: RequestInit = {},
): Promise<Response> {
  try {
    return await fetch(`${API_URL}${ruta}`, {
      ...opciones,
      headers: {
        "Content-Type": "application/json",
        ...(opciones.headers as Record<string, string>),
      },
    });
  } catch {
    throw new Error(
      "No se pudo conectar. Revisa tu conexion e intentalo de nuevo.",
    );
  }
}

export const LookupService = {
  async solicitarCodigo(correo: string): Promise<void> {
    const res = await fetchJSON("/api/visits/lookup/request-code", {
      method: "POST",
      body: JSON.stringify({ correo }),
    });

    if (res.status === 429) throw new DemasiadosIntentosError();
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        body.error ?? "No se pudo enviar el codigo de verificacion",
      );
    }

    const body = await res.json();
    challenge = {
      challengeId: body.challengeId,
      browserSecret: body.browserSecret,
      correo,
    };
  },

  async verificarCodigo(code: string): Promise<void> {
    if (!challenge)
      throw new Error("Primero solicita un codigo de verificacion");

    const res = await fetchJSON("/api/visits/lookup/verify-code", {
      method: "POST",
      body: JSON.stringify({
        challengeId: challenge.challengeId,
        browserSecret: challenge.browserSecret,
        code,
      }),
    });

    if (res.status === 401) {
      const body = await res.json().catch(() => ({}));
      throw new CodigoInvalidoError(body.error);
    }
    if (res.status === 429) throw new DemasiadosIntentosError();
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "No se pudo verificar el codigo");
    }

    const body = await res.json();
    session = {
      accessToken: body.accessToken,
      correo: challenge.correo,
      expiresAt: Date.now() + (body.expiresIn ?? 900) * 1000,
    };
    challenge = null;
  },

  async obtenerHistorial(): Promise<Visita[]> {
    if (!session) throw new SesionLookupExpiradaError();
    if (Date.now() >= session.expiresAt) {
      session = null;
      throw new SesionLookupExpiradaError();
    }

    const res = await fetchJSON(
      `/api/visits/me?correo=${encodeURIComponent(session.correo)}`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } },
    );

    if (res.status === 401) {
      session = null;
      throw new SesionLookupExpiradaError();
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "No se pudo cargar el historial");
    }

    const body = await res.json();
    const visitas = body.data ?? body;
    return Array.isArray(visitas) ? visitas : [];
  },

  async cerrarSesion(): Promise<void> {
    if (!session) return;
    const token = session.accessToken;
    session = null;
    challenge = null;
    try {
      await fetchJSON("/api/visits/lookup/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Best effort: la sesion ya se limpio de memoria
    }
  },

  sesionActiva(): boolean {
    return session !== null && Date.now() < session.expiresAt;
  },

  correoActivo(): string | null {
    return session?.correo ?? null;
  },

  tiempoRestante(): number {
    if (!session) return 0;
    return Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 1000));
  },

  limpiar(): void {
    challenge = null;
    session = null;
  },
};

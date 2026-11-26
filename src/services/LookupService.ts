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
    super(mensaje ?? "El código es incorrecto o ya venció.");
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
    super("Tu sesión de consulta expiró. Solicita un nuevo código.");
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
      "No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.",
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
        body?.error ?? "No se pudo enviar el código de verificación. Inténtalo de nuevo.",
      );
    }

    const body = await res.json().catch(() => {
      throw new Error("No se pudo confirmar el envío del código. Inténtalo de nuevo.");
    });
    challenge = {
      challengeId: body.challengeId,
      browserSecret: body.browserSecret,
      correo,
    };
  },

  async verificarCodigo(code: string): Promise<void> {
    if (!challenge)
      throw new Error("Solicita un nuevo código de verificación.");

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
      throw new CodigoInvalidoError(body?.error);
    }
    if (res.status === 429) throw new DemasiadosIntentosError();
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? "No se pudo verificar el código. Inténtalo de nuevo.");
    }

    const body = await res.json().catch(() => {
      throw new Error("No se pudo verificar el código. Solicita uno nuevo para volver a intentarlo.");
    });
    session = {
      accessToken: body.accessToken,
      correo: challenge.correo,
      expiresAt: Date.now() + (body.expiresIn ?? 900) * 1000,
    };
    challenge = null;
  },

  async obtenerHistorial(): Promise<Visita[]> {
    const mensaje = "No se pudo cargar el historial. Solicita un nuevo código para volver a intentarlo.";
    if (!session) throw new SesionLookupExpiradaError();
    if (Date.now() >= session.expiresAt) {
      session = null;
      throw new SesionLookupExpiradaError();
    }

    const res = await fetchJSON(
      `/api/visits/lookup?correo=${encodeURIComponent(session.correo)}`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } },
    );

    if (res.status === 401) {
      session = null;
      throw new SesionLookupExpiradaError();
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error ?? mensaje);

    const visitas = body?.data ?? body;
    if (!Array.isArray(visitas)) throw new Error(mensaje);
    // El lookup devuelve el departamento como "Departamentos"; la pantalla
    // usa "departamento", igual que /api/visits/me.
    return visitas.map((v) => ({
      ...v,
      departamento: v.departamento ?? v.Departamentos,
    }));
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

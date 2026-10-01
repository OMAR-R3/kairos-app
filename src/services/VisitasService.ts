// Facade: unico punto por el que la app habla con la API de Kairos (Next.js).
// La app nunca habla directo con Supabase.

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export type DatosRegistro = {
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string | null;
  correo: string;
  telefono: string;
  password: string;
};

export const VisitasService = {
  // TODO: login(), agendarVisita(), obtenerVisitas(), obtenerQR()...

  async registrarVisitante(datos: DatosRegistro): Promise<void> {
    // Cambiar la ruta por la real del backend
    const res = await fetch(`${API_URL}/api/visitantes/registro`, {
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
};
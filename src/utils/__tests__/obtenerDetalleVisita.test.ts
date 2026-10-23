import {
  SesionExpiradaError,
  VisitaNoEncontradaError,
  VisitasService,
} from "@/services/VisitasService";
import * as SecureStore from "expo-secure-store";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue("token-prueba"),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

const respuesta = (status: number, body: unknown) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

const detalle = (estado = "pendiente") => ({
  id: 49,
  folio: "KV-000049",
  estado,
  fecha: "2026-10-14",
  hora_inicio: "09:53:00",
  motivo: "solicitar información",
  departamento: { id: 15, nombre: "CIUT", ubicacion: "Edificio C" },
});

const MENSAJE_GENERICO =
  "No fue posible cargar los detalles de la visita. Inténtalo de nuevo.";

describe("VisitasService.obtenerDetalleVisita", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    (SecureStore.deleteItemAsync as jest.Mock).mockClear();
  });

  it("devuelve el detalle de la visita cuando la respuesta es correcta", async () => {
    mockFetch.mockResolvedValue(respuesta(200, { success: true, data: detalle() }));

    const r = await VisitasService.obtenerDetalleVisita("49");

    expect(r.id).toBe(49);
    expect(r.folio).toBe("KV-000049");
    expect(r.departamento?.nombre).toBe("CIUT");
    expect(r.motivo).toBe("solicitar información");
  });

  it("consulta GET /api/visits/me/{id} con el token del visitante", async () => {
    mockFetch.mockResolvedValue(respuesta(200, { success: true, data: detalle() }));

    await VisitasService.obtenerDetalleVisita("49");

    const [url, opciones] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/visits/me/49");
    expect(opciones.method).toBe("GET");
    expect(opciones.headers.Authorization).toBe("Bearer token-prueba");
  });

  it.each(["pendiente", "aprobada", "rechazada"])(
    "devuelve el estatus %s tal como lo manda el servidor",
    async (estado) => {
      mockFetch.mockResolvedValue(
        respuesta(200, { success: true, data: detalle(estado) })
      );

      const r = await VisitasService.obtenerDetalleVisita("49");

      expect(r.estado).toBe(estado);
    }
  );

  it("lanza VisitaNoEncontradaError cuando la visita no existe (404)", async () => {
    mockFetch.mockResolvedValue(respuesta(404, { success: false }));

    const promesa = VisitasService.obtenerDetalleVisita("999");

    await expect(promesa).rejects.toBeInstanceOf(VisitaNoEncontradaError);
    await expect(promesa).rejects.toThrow("No se encontró la visita solicitada.");
  });

  it("propaga el error cuando falla la red", async () => {
    mockFetch.mockRejectedValue(new TypeError("Network request failed"));

    await expect(VisitasService.obtenerDetalleVisita("49")).rejects.toThrow(
      "Network request failed"
    );
  });

  it("con sesión expirada (401) borra el token y lanza SesionExpiradaError", async () => {
    mockFetch.mockResolvedValue(respuesta(401, {}));

    await expect(VisitasService.obtenerDetalleVisita("49")).rejects.toBeInstanceOf(
      SesionExpiradaError
    );
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
  });

  it("lanza el mensaje del servidor cuando responde con error", async () => {
    mockFetch.mockResolvedValue(respuesta(500, { error: "Error interno" }));

    await expect(VisitasService.obtenerDetalleVisita("49")).rejects.toThrow(
      "Error interno"
    );
  });

  it("lanza un mensaje claro cuando el error no trae detalle", async () => {
    mockFetch.mockResolvedValue({
      status: 500,
      ok: false,
      json: async () => {
        throw new Error("sin cuerpo");
      },
    });

    await expect(VisitasService.obtenerDetalleVisita("49")).rejects.toThrow(
      MENSAJE_GENERICO
    );
  });

  it("lanza un mensaje claro cuando la respuesta no trae datos", async () => {
    mockFetch.mockResolvedValue(respuesta(200, { success: true, data: null }));

    await expect(VisitasService.obtenerDetalleVisita("49")).rejects.toThrow(
      MENSAJE_GENERICO
    );
  });

  it.each(["", "abc", "12a", "0", "000", "-5", "1.5"])(
    "rechaza el identificador inválido %p sin llamar al servidor",
    async (id) => {
      await expect(VisitasService.obtenerDetalleVisita(id)).rejects.toThrow(
        "El identificador de la visita no es válido."
      );
      expect(mockFetch).not.toHaveBeenCalled();
    }
  );
});

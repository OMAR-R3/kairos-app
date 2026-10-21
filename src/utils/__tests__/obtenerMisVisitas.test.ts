import { SesionExpiradaError, VisitasService } from "@/services/VisitasService";
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

const visita = (id: number, estado = "pendiente") => ({
  id,
  folio: `KV-${String(id).padStart(6, "0")}`,
  departamento: { id: 15, nombre: "CIUT", ubicacion: "Edificio C" },
  fecha: "2026-10-14",
  hora_inicio: "09:53:00",
  motivo: "solicitar información",
  estado,
});

describe("VisitasService.obtenerMisVisitas", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    (SecureStore.deleteItemAsync as jest.Mock).mockClear();
  });

  it("devuelve la lista de visitas del visitante", async () => {
    mockFetch.mockResolvedValue(
      respuesta(200, { success: true, data: [visita(49), visita(45, "aprobada")] })
    );

    const r = await VisitasService.obtenerMisVisitas();

    expect(r).toHaveLength(2);
    expect(r[0].id).toBe(49);
    expect(r[1].estado).toBe("aprobada");
  });

  it("consulta GET /api/visits/me con el token del visitante", async () => {
    mockFetch.mockResolvedValue(respuesta(200, { success: true, data: [] }));

    await VisitasService.obtenerMisVisitas();

    const [url, opciones] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/visits/me");
    expect(opciones.method).toBe("GET");
    expect(opciones.headers.Authorization).toBe("Bearer token-prueba");
  });

  it("devuelve una lista vacía cuando el visitante no tiene visitas", async () => {
    mockFetch.mockResolvedValue(respuesta(200, { success: true, data: [] }));

    await expect(VisitasService.obtenerMisVisitas()).resolves.toEqual([]);
  });

  it("devuelve una lista vacía cuando la respuesta no trae una lista", async () => {
    mockFetch.mockResolvedValue(respuesta(200, { success: true, data: null }));

    await expect(VisitasService.obtenerMisVisitas()).resolves.toEqual([]);
  });

  it("lanza el mensaje del servidor cuando responde con error", async () => {
    mockFetch.mockResolvedValue(respuesta(500, { error: "Error interno" }));

    await expect(VisitasService.obtenerMisVisitas()).rejects.toThrow("Error interno");
  });

  it("lanza un mensaje claro cuando el error no trae detalle", async () => {
    mockFetch.mockResolvedValue({
      status: 500,
      ok: false,
      json: async () => {
        throw new Error("sin cuerpo");
      },
    });

    await expect(VisitasService.obtenerMisVisitas()).rejects.toThrow(
      "No se pudieron cargar las visitas"
    );
  });

  it("propaga el error cuando falla la red", async () => {
    mockFetch.mockRejectedValue(new TypeError("Network request failed"));

    await expect(VisitasService.obtenerMisVisitas()).rejects.toThrow(
      "Network request failed"
    );
  });

  it("con sesión expirada (401) borra el token y lanza SesionExpiradaError", async () => {
    mockFetch.mockResolvedValue(respuesta(401, {}));

    await expect(VisitasService.obtenerMisVisitas()).rejects.toBeInstanceOf(
      SesionExpiradaError
    );
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
  });
});

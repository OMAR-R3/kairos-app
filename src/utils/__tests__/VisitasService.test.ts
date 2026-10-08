import { generarFolio, SesionExpiradaError, VisitasService } from "@/services/VisitasService";
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

describe("VisitasService visitas", () => {
  beforeEach(() => mockFetch.mockReset());

  it("genera folio con 6 digitos", () => {
    expect(generarFolio(123)).toBe("KV-000123");
  });

  it("obtiene departamentos con Bearer", async () => {
    mockFetch.mockResolvedValue(
      respuesta(200, { success: true, data: [{ id: 3, nombre: "Vinculacion", ubicacion: "Edificio C" }] })
    );
    const r = await VisitasService.obtenerDepartamentos();
    expect(r[0].nombre).toBe("Vinculacion");
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe("Bearer token-prueba");
  });

  it("agenda visita y regresa folio", async () => {
    mockFetch.mockResolvedValue(respuesta(201, { success: true, data: { id: 21, estado: "pendiente" } }));
    const r = await VisitasService.agendarVisita({
      depto_id: 3, fecha: "2026-10-09", hora_inicio: "10:00:00", motivo: "Reunion",
    });
    expect(r.folio).toBe("KV-000021");
  });

  it("409 da mensaje de duplicada", async () => {
    mockFetch.mockResolvedValue(respuesta(409, {}));
    await expect(
      VisitasService.agendarVisita({ depto_id: 3, fecha: "2026-10-09", hora_inicio: "10:00:00", motivo: "x" })
    ).rejects.toThrow("Ya tienes una visita");
  });

  it("401 borra el token y lanza SesionExpiradaError", async () => {
    mockFetch.mockResolvedValue(respuesta(401, {}));
    await expect(VisitasService.obtenerDepartamentos()).rejects.toBeInstanceOf(SesionExpiradaError);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
  });
});
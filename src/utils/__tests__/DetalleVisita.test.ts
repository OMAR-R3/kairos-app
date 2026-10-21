import {
  DetalleVisita,
  SesionExpiradaError,
  VisitaNoEncontradaError,
  VisitasService,
} from "@/services/VisitasService";
import * as SecureStore from "expo-secure-store";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue("token-prueba"),
  deleteItemAsync: jest.fn(),
}));

const mockFetch = jest.fn();
const fetchOriginal = global.fetch;
const detalle: DetalleVisita = {
  id: 123,
  folio: "KV-000123",
  estado: "pendiente",
  fecha: "2026-10-20",
  hora_inicio: "10:00:00",
  motivo: "Visita académica",
  departamento: { id: 3, nombre: "Vinculación", ubicacion: "Edificio C" },
};

function respuesta(status: number, body: unknown) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

describe("obtenerDetalleVisita", () => {
  beforeAll(() => { global.fetch = mockFetch; });
  afterAll(() => { global.fetch = fetchOriginal; });
  beforeEach(() => {
    mockFetch.mockReset();
    jest.clearAllMocks();
  });

  it("extrae data y consulta el endpoint con GET y Bearer", async () => {
    mockFetch.mockResolvedValue(respuesta(200, { success: true, data: detalle }));
    await expect(VisitasService.obtenerDetalleVisita("123")).resolves.toEqual(detalle);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      `${process.env.EXPO_PUBLIC_API_URL}/api/visits/me/123`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer token-prueba" }),
        body: undefined,
      })
    );
  });

  it("admite departamento null", async () => {
    mockFetch.mockResolvedValue(respuesta(200, { success: true, data: { ...detalle, departamento: null } }));
    await expect(VisitasService.obtenerDetalleVisita("123")).resolves.toEqual({ ...detalle, departamento: null });
  });

  it("401 conserva SesionExpiradaError y elimina el token", async () => {
    mockFetch.mockResolvedValue(respuesta(401, {}));
    await expect(VisitasService.obtenerDetalleVisita("123")).rejects.toBeInstanceOf(SesionExpiradaError);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("kairos_visitante_token");
  });

  it("404 distingue una visita inexistente o ajena", async () => {
    mockFetch.mockResolvedValue(respuesta(404, {}));
    await expect(VisitasService.obtenerDetalleVisita("123")).rejects.toBeInstanceOf(VisitaNoEncontradaError);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it.each([403, 500])("HTTP %s conserva el error del servidor sin borrar la sesión", async (status) => {
    mockFetch.mockResolvedValue(respuesta(status, { error: "Error del servidor" }));
    await expect(VisitasService.obtenerDetalleVisita("123")).rejects.toThrow("Error del servidor");
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it("usa un mensaje alternativo si el error no contiene JSON", async () => {
    mockFetch.mockResolvedValue({ ...respuesta(500, null), json: async () => { throw new SyntaxError(); } });
    await expect(VisitasService.obtenerDetalleVisita("123")).rejects.toThrow("No fue posible cargar los detalles");
  });

  it("propaga el error de red existente", async () => {
    const error = new TypeError("Network request failed");
    mockFetch.mockRejectedValue(error);
    await expect(VisitasService.obtenerDetalleVisita("123")).rejects.toBe(error);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it.each(["", "0", "-1", "1.5", "abc", "../123", "123?otro=1", " 123 "])("rechaza ID inválido %j sin consultar la API", async (id) => {
    await expect(VisitasService.obtenerDetalleVisita(id)).rejects.toThrow("identificador");
    expect(mockFetch).not.toHaveBeenCalled();
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
  });

  it("rechaza un éxito sin detalle", async () => {
    mockFetch.mockResolvedValue(respuesta(200, { success: true, data: null }));
    await expect(VisitasService.obtenerDetalleVisita("123")).rejects.toThrow("No fue posible cargar los detalles");
  });
});

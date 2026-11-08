import * as SecureStore from "expo-secure-store";
import { SesionExpiradaError, VisitaNoEncontradaError, VisitasService } from "@/services/VisitasService";

jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn().mockResolvedValue("jwt-prueba"), deleteItemAsync: jest.fn() }));
const originalFetch = global.fetch;
const mockFetch = jest.fn();
const valido = { visita_id: 123, folio: "KV-000123", qr: "token-real", estado_qr: "valido", vigente_desde: "2026-11-07T17:30:00.000Z", vigente_hasta: "2026-11-07T18:30:00.000Z" };
const respuesta = (status: number, body: unknown) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
beforeAll(() => { global.fetch = mockFetch; });
afterAll(() => { global.fetch = originalFetch; });
beforeEach(() => { mockFetch.mockReset(); jest.clearAllMocks(); });

it.each(["valido", "expirado", "usado"])("admite el estado %s y usa el JWT compartido", async estado_qr => {
  const data = { ...valido, estado_qr, qr: estado_qr === "valido" ? valido.qr : null };
  mockFetch.mockResolvedValue(respuesta(200, { success: true, data }));
  await expect(VisitasService.obtenerQR("123")).resolves.toEqual(data);
  expect(mockFetch).toHaveBeenCalledWith(`${process.env.EXPO_PUBLIC_API_URL}/api/visits/me/123/qr`, expect.objectContaining({ method: "GET", headers: expect.objectContaining({ Authorization: "Bearer jwt-prueba" }) }));
});
it.each(["", "0", "01", "-1", "abc", "1/qr", "9007199254740992"])("rechaza id %s antes de consultar", async id => {
  await expect(VisitasService.obtenerQR(id)).rejects.toThrow("identificador");
  expect(mockFetch).not.toHaveBeenCalled();
});
it.each([
  { estado_qr: "utilizado" }, { estado_qr: "desconocido" }, { qr: null }, { qr: " " },
  { estado_qr: "usado", qr: "no-exponer" }, { visita_id: 124 }, { visita_id: "123" },
  { folio: "" }, { vigente_desde: "ayer" }, { vigente_hasta: "2026-02-30T18:30:00.000Z" },
  { vigente_hasta: valido.vigente_desde },
])("rechaza contrato inconsistente %j", async cambio => {
  mockFetch.mockResolvedValue(respuesta(200, { success: true, data: { ...valido, ...cambio } }));
  await expect(VisitasService.obtenerQR("123")).rejects.toThrow("respuesta");
});
it.each([null, {}, { success: false, data: valido }, { success: true, data: null }])("rechaza envoltorio inválido %j", async body => {
  mockFetch.mockResolvedValue(respuesta(200, body));
  await expect(VisitasService.obtenerQR("123")).rejects.toThrow("respuesta");
});
it("mantiene el manejo de sesión expirada", async () => {
  mockFetch.mockResolvedValue(respuesta(401, {}));
  await expect(VisitasService.obtenerQR("123")).rejects.toBeInstanceOf(SesionExpiradaError);
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("kairos_visitante_token");
});
it("distingue visita inexistente", async () => {
  mockFetch.mockResolvedValue(respuesta(404, {}));
  await expect(VisitasService.obtenerQR("123")).rejects.toBeInstanceOf(VisitaNoEncontradaError);
});
it.each([403, 409, 429, 500])("preserva errores HTTP %s sin eliminar sesión", async status => {
  mockFetch.mockResolvedValue(respuesta(status, { error: "Mensaje del servidor" }));
  await expect(VisitasService.obtenerQR("123")).rejects.toThrow("Mensaje del servidor");
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
});
it("maneja desconexión y propaga la señal de cancelación", async () => {
  const controller = new AbortController();
  mockFetch.mockRejectedValue(new Error("Network failed"));
  await expect(VisitasService.obtenerQR("123", controller.signal)).rejects.toThrow("No se pudo conectar");
  expect(mockFetch.mock.calls[0][1].signal).toBe(controller.signal);
});
it("maneja JSON ilegible", async () => {
  mockFetch.mockResolvedValue({ ...respuesta(200, null), json: async () => { throw new SyntaxError(); } });
  await expect(VisitasService.obtenerQR("123")).rejects.toThrow("respuesta");
});

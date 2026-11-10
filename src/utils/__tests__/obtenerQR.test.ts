import * as SecureStore from "expo-secure-store";
import { SesionExpiradaError, VisitaNoEncontradaError, VisitasService } from "../../services/VisitasService";

// Pruebas del servicio que obtiene el QR del visitante (HU-06).
// Complementan CodigoQR.test.ts: mensajes que ve el usuario, forma de la petición y datos devueltos.
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockObtenerToken = SecureStore.getItemAsync as jest.Mock;
const originalFetch = global.fetch;
const mockFetch = jest.fn();

const valido = {
  visita_id: 123,
  folio: "KV-000123",
  qr: "token-real",
  estado_qr: "valido",
  vigente_desde: "2026-11-07T17:30:00.000Z",
  vigente_hasta: "2026-11-07T18:30:00.000Z",
};
const respuesta = (status: number, body: unknown) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

beforeAll(() => { global.fetch = mockFetch; });
afterAll(() => { global.fetch = originalFetch; });
beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset();
  mockObtenerToken.mockResolvedValue("jwt-prueba");
});

describe("obtenerQR — estados", () => {
  it("devuelve el código y su vigencia cuando el estado es válido", async () => {
    mockFetch.mockResolvedValue(respuesta(200, { success: true, data: valido }));
    await expect(VisitasService.obtenerQR("123")).resolves.toEqual(valido);
  });

  it("devuelve el estado expirado sin código", async () => {
    const data = { ...valido, estado_qr: "expirado", qr: null };
    mockFetch.mockResolvedValue(respuesta(200, { success: true, data }));
    const qr = await VisitasService.obtenerQR("123");
    expect(qr.estado_qr).toBe("expirado");
    expect(qr.qr).toBeNull();
  });

  it("devuelve el estado usado sin código", async () => {
    const data = { ...valido, estado_qr: "usado", qr: null };
    mockFetch.mockResolvedValue(respuesta(200, { success: true, data }));
    const qr = await VisitasService.obtenerQR("123");
    expect(qr.estado_qr).toBe("usado");
    expect(qr.qr).toBeNull();
  });

  it.each(["expirado", "usado"])("rechaza un QR %s que todavía trae código", async estado_qr => {
    mockFetch.mockResolvedValue(respuesta(200, { success: true, data: { ...valido, estado_qr, qr: "no-exponer" } }));
    await expect(VisitasService.obtenerQR("123")).rejects.toThrow("La respuesta del código QR no es válida. Inténtalo de nuevo.");
  });

  it("acepta fechas ISO sin milisegundos", async () => {
    const data = { ...valido, vigente_desde: "2026-11-07T17:30:00Z", vigente_hasta: "2026-11-07T18:30:00Z" };
    mockFetch.mockResolvedValue(respuesta(200, { success: true, data }));
    await expect(VisitasService.obtenerQR("123")).resolves.toEqual(data);
  });

  it("devuelve solo los campos del contrato y descarta los demás", async () => {
    const data = { ...valido, correo: "persona@correo.com", usuario_id: 7 };
    mockFetch.mockResolvedValue(respuesta(200, { success: true, data }));
    const qr = await VisitasService.obtenerQR("123");
    expect(Object.keys(qr).sort()).toEqual(["estado_qr", "folio", "qr", "vigente_desde", "vigente_hasta", "visita_id"]);
  });
});

describe("obtenerQR — petición", () => {
  it("consulta la ruta de la visita con GET y el token de sesión", async () => {
    mockFetch.mockResolvedValue(respuesta(200, { success: true, data: valido }));
    await VisitasService.obtenerQR("123");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opciones] = mockFetch.mock.calls[0];
    expect(url).toBe(`${process.env.EXPO_PUBLIC_API_URL}/api/visits/me/123/qr`);
    expect(opciones.method).toBe("GET");
    expect(opciones.headers.Authorization).toBe("Bearer jwt-prueba");
  });

  it("no envía Authorization cuando no hay sesión guardada", async () => {
    mockObtenerToken.mockResolvedValue(null);
    mockFetch.mockResolvedValue(respuesta(200, { success: true, data: valido }));
    await VisitasService.obtenerQR("123");
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
});

describe("obtenerQR — errores", () => {
  it("visita no encontrada: lanza VisitaNoEncontradaError con su mensaje y conserva la sesión", async () => {
    mockFetch.mockResolvedValue(respuesta(404, {}));
    const promesa = VisitasService.obtenerQR("123");
    await expect(promesa).rejects.toBeInstanceOf(VisitaNoEncontradaError);
    await expect(promesa).rejects.toThrow("No se encontró la visita solicitada.");
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it("sesión expirada: borra el token y lanza SesionExpiradaError con su mensaje", async () => {
    mockFetch.mockResolvedValue(respuesta(401, {}));
    const promesa = VisitasService.obtenerQR("123");
    await expect(promesa).rejects.toBeInstanceOf(SesionExpiradaError);
    await expect(promesa).rejects.toThrow("Tu sesión expiró, inicia sesión de nuevo");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("kairos_visitante_token");
  });

  it("error de conexión: muestra el mensaje amigable y conserva la sesión", async () => {
    mockFetch.mockRejectedValue(new TypeError("Network request failed"));
    await expect(VisitasService.obtenerQR("123")).rejects.toThrow("No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.");
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it("usa el mensaje genérico cuando el servidor falla sin texto", async () => {
    mockFetch.mockResolvedValue(respuesta(500, { error: 500 }));
    await expect(VisitasService.obtenerQR("123")).rejects.toThrow("No se pudo obtener el código QR.");
  });

  it("usa el mensaje genérico cuando la respuesta de error no es JSON", async () => {
    mockFetch.mockResolvedValue({ status: 502, ok: false, json: async () => { throw new SyntaxError("Unexpected token"); } });
    await expect(VisitasService.obtenerQR("123")).rejects.toThrow("No se pudo obtener el código QR.");
  });

  it("muestra el mensaje del servidor cuando se alcanza el límite de peticiones", async () => {
    mockFetch.mockResolvedValue(respuesta(429, { error: "Demasiados intentos" }));
    await expect(VisitasService.obtenerQR("123")).rejects.toThrow("Demasiados intentos");
  });

  it("no consulta cuando el identificador no es válido", async () => {
    await expect(VisitasService.obtenerQR("abc")).rejects.toThrow("El identificador de la visita no es válido.");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

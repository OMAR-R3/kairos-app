// HU-7: cierre de sesión seguro. Al cerrar sesión la app baja el token de push,
// invalida la sesión en el servidor, olvida el token y borra el JWT, en ese orden.
const mockDisk = new Map<string, string>();
const mockEventos: string[] = [];
const mockGet = jest.fn(async (key: string) => mockDisk.get(key) ?? null);
const mockSet = jest.fn(async (key: string, value: string) => { mockDisk.set(key, value); });
const mockDelete = jest.fn(async (key: string) => { mockEventos.push(`borrar:${key}`); mockDisk.delete(key); });
const mockTokenPush = jest.fn(async (): Promise<string | null> => null);
const mockOlvidar = jest.fn(async () => { mockEventos.push("olvidarToken"); });
jest.mock("expo-secure-store", () => ({
  getItemAsync: mockGet, setItemAsync: mockSet, deleteItemAsync: mockDelete,
}));
jest.mock("../../services/NotificacionesService", () => ({
  NotificacionesService: { tokenGuardado: mockTokenPush, guardarToken: jest.fn(), olvidarToken: mockOlvidar },
}));

const TOKEN = "kairos_visitante_token";
const jwt = btoa(JSON.stringify({ sub: 1, exp: 4102444800 }));
const JWT = `e30.${jwt}.firma`;
const respuesta = (status: number, data: unknown = {}) => ({ status, ok: status >= 200 && status < 300, json: async () => data });
const mockFetch = jest.fn();
const originalFetch = global.fetch;
let service: typeof import("../../services/VisitasService").VisitasService;
let errores: typeof import("../../services/VisitasService");

function llamadas() { return mockFetch.mock.calls.map(([url, op]) => `${op.method} ${String(url).replace(/^undefined/, "")}`); }

beforeEach(() => {
  jest.useFakeTimers();
  mockDisk.clear(); mockEventos.length = 0;
  mockGet.mockClear(); mockSet.mockClear(); mockDelete.mockClear(); mockTokenPush.mockClear(); mockOlvidar.mockClear();
  mockGet.mockImplementation(async key => mockDisk.get(key) ?? null);
  mockDelete.mockImplementation(async key => { mockEventos.push(`borrar:${key}`); mockDisk.delete(key); });
  mockOlvidar.mockImplementation(async () => { mockEventos.push("olvidarToken"); });
  mockTokenPush.mockResolvedValue("push-token");
  mockFetch.mockReset();
  mockFetch.mockImplementation(async (_url: string, op: { method: string }) => {
    mockEventos.push(`${op.method} ${String(_url).replace(/^undefined/, "")}`);
    return respuesta(200, { success: true, revocada: true });
  });
  global.fetch = mockFetch;
  mockDisk.set(TOKEN, JWT);
  jest.resetModules();
  errores = jest.requireActual("../../services/VisitasService");
  service = errores.VisitasService;
});
afterEach(() => { jest.useRealTimers(); global.fetch = originalFetch; });

describe("orden del cierre de sesión", () => {
  it("baja el push, revoca en el servidor, olvida el token y borra el JWT, en ese orden", async () => {
    await service.logout();
    expect(mockEventos.slice(0, 4)).toEqual([
      "DELETE /api/visitants/me/push-token",
      "POST /api/visitants/me/logout",
      "olvidarToken",
      `borrar:${TOKEN}`,
    ]);
    expect(mockDisk.has(TOKEN)).toBe(false);
  });

  it("llama al servidor con Authorization Bearer y sin cuerpo", async () => {
    await service.logout();
    const [, opciones] = mockFetch.mock.calls.find(([url]) => String(url).endsWith("/api/visitants/me/logout"))!;
    expect(opciones.method).toBe("POST");
    expect(opciones.headers.Authorization).toBe(`Bearer ${JWT}`);
    expect(opciones.body).toBeUndefined();
  });

  it("el JWT sigue guardado mientras se revoca la sesión en el servidor", async () => {
    let jwtPresente: boolean | undefined;
    mockFetch.mockImplementation(async (url: string) => {
      if (String(url).endsWith("/logout")) jwtPresente = mockDisk.has(TOKEN);
      return respuesta(200, { success: true, revocada: true });
    });
    await service.logout();
    expect(jwtPresente).toBe(true);
  });

  it("sin token de push solo revoca la sesión y olvida el token", async () => {
    mockTokenPush.mockResolvedValue(null);
    await service.logout();
    expect(llamadas()).toEqual(["POST /api/visitants/me/logout"]);
    expect(mockOlvidar).toHaveBeenCalledTimes(1);
    expect(mockDisk.has(TOKEN)).toBe(false);
  });
});

describe("el cierre local siempre se completa", () => {
  it("sin conexión: no lanza, borra el JWT y olvida el token", async () => {
    mockFetch.mockRejectedValue(new TypeError("Network request failed"));
    await expect(service.logout()).resolves.toBeUndefined();
    expect(mockOlvidar).toHaveBeenCalledTimes(1);
    expect(mockDisk.has(TOKEN)).toBe(false);
  });

  it("si falla la baja del push igual revoca la sesión en el servidor", async () => {
    mockFetch.mockImplementation(async (url: string) =>
      String(url).endsWith("/push-token") ? respuesta(500) : respuesta(200, { success: true, revocada: true }));
    await expect(service.logout()).resolves.toBeUndefined();
    expect(llamadas()).toEqual(["DELETE /api/visitants/me/push-token", "POST /api/visitants/me/logout"]);
    expect(mockDisk.has(TOKEN)).toBe(false);
  });

  it.each([401, 500, 503])("el servidor responde %s: no lanza y borra la sesión local", async estado => {
    mockFetch.mockImplementation(async (url: string) =>
      String(url).endsWith("/logout") ? respuesta(estado, { error: "Sesión cerrada" }) : respuesta(200));
    await expect(service.logout()).resolves.toBeUndefined();
    expect(mockOlvidar).toHaveBeenCalledTimes(1);
    expect(mockDisk.has(TOKEN)).toBe(false);
  });

  it("si el servidor no responde, cancela a los 8 s y cierra la sesión local", async () => {
    mockFetch.mockImplementation((url: string, op: { signal: AbortSignal }) => String(url).endsWith("/logout")
      ? new Promise((_, rechazar) => op.signal.addEventListener("abort", () => rechazar(Object.assign(new Error("abort"), { name: "AbortError" }))))
      : Promise.resolve(respuesta(200)));
    const cierre = service.logout();
    await jest.advanceTimersByTimeAsync(7999);
    expect(mockDisk.has(TOKEN)).toBe(true);
    await jest.advanceTimersByTimeAsync(1);
    await expect(cierre).resolves.toBeUndefined();
    expect(mockDisk.has(TOKEN)).toBe(false);
  });

  it("si falla olvidarToken igual borra el JWT", async () => {
    mockOlvidar.mockRejectedValue(new Error("storage"));
    await expect(service.logout()).resolves.toBeUndefined();
    expect(mockDisk.has(TOKEN)).toBe(false);
  });

  it("si no se puede borrar el JWT, informa el error", async () => {
    mockDelete.mockRejectedValue(new Error("storage"));
    await expect(service.logout()).rejects.toThrow("No se pudieron eliminar");
  });
});

describe("sesión cerrada desde otro lugar", () => {
  it("una ruta que responde 401 “Sesión cerrada” se trata como token vencido", async () => {
    mockFetch.mockImplementation(async () => respuesta(401, { error: "Sesión cerrada" }));
    await expect(service.obtenerDepartamentos()).rejects.toBeInstanceOf(errores.SesionExpiradaError);
    expect(mockDisk.has(TOKEN)).toBe(false);
  });
});

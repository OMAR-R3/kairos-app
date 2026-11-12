const mockDisk = new Map<string, string>();
const mockGet = jest.fn(async (key: string) => mockDisk.get(key) ?? null);
const mockSet = jest.fn(async (key: string, value: string) => {
  mockDisk.set(key, value);
});
const mockDelete = jest.fn(async (key: string) => {
  mockDisk.delete(key);
});
const mockPush = jest.fn(async (): Promise<string | null> => null);
jest.mock("expo-secure-store", () => ({
  getItemAsync: mockGet,
  setItemAsync: mockSet,
  deleteItemAsync: mockDelete,
}));
jest.mock("../../services/NotificacionesService", () => ({
  NotificacionesService: {
    tokenGuardado: mockPush,
    guardarToken: jest.fn(),
    olvidarToken: jest.fn(),
  },
}));

const TOKEN = "kairos_visitante_token";
const CACHE = "kairos_ultimo_qr";
const SESSION = "kairos_qr_sesion";
const now = Date.parse("2026-11-07T18:00:00Z");
const qr = {
  visita_id: 123,
  folio: "KV-000123",
  qr: "token-qr",
  estado_qr: "valido" as const,
  vigente_desde: "2026-11-07T17:30:00.000Z",
  vigente_hasta: "2026-11-07T18:30:00.000Z",
};
const jwt = (user = 1, exp = now / 1000 + 3600) =>
  `e30.${btoa(JSON.stringify({ sub: user, exp }))}.firma`;
const response = (status: number, data: unknown) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => data,
});
let service: typeof import("../../services/VisitasService").VisitasService;
let cache: typeof import("../../services/QRCacheService").QRCacheService;
const mockFetch = jest.fn();
const originalFetch = global.fetch;
function cargarModulos() {
  jest.resetModules();
  service = jest.requireActual<typeof import("../../services/VisitasService")>(
    "../../services/VisitasService",
  ).VisitasService;
  cache = jest.requireActual<typeof import("../../services/QRCacheService")>(
    "../../services/QRCacheService",
  ).QRCacheService;
}
async function guardar() {
  mockFetch.mockResolvedValue(response(200, { success: true, data: qr }));
  await service.obtenerQR("123");
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(now);
  mockDisk.clear();
  mockGet.mockClear();
  mockSet.mockClear();
  mockDelete.mockClear();
  mockPush.mockClear();
  mockGet.mockImplementation(async (key) => mockDisk.get(key) ?? null);
  mockSet.mockImplementation(async (key, value) => {
    mockDisk.set(key, value);
  });
  mockDelete.mockImplementation(async (key) => {
    mockDisk.delete(key);
  });
  mockPush.mockResolvedValue(null);
  mockFetch.mockReset();
  global.fetch = mockFetch;
  mockDisk.set(TOKEN, jwt());
  cargarModulos();
});
afterEach(() => {
  jest.useRealTimers();
  global.fetch = originalFetch;
});

describe("QR con conexión", () => {
  it("devuelve el QR válido consultando la ruta de la visita con el JWT", async () => {
    mockFetch.mockResolvedValue(response(200, { success: true, data: qr }));
    await expect(service.obtenerQR("123")).resolves.toEqual(qr);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/visits/me/123/qr"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${jwt()}` }),
      }),
    );
  });

  it("guarda la copia local tras consultar un QR válido", async () => {
    await guardar();
    expect(mockDisk.has(CACHE)).toBe(true);
  });

  it("lanza VisitaNoEncontradaError con 404 y no guarda nada", async () => {
    const { VisitaNoEncontradaError } = jest.requireActual<
      typeof import("../../services/VisitasService")
    >("../../services/VisitasService");
    mockFetch.mockResolvedValue(response(404, {}));
    await expect(service.obtenerQR("123")).rejects.toBeInstanceOf(
      VisitaNoEncontradaError,
    );
    expect(mockDisk.has(CACHE)).toBe(false);
  });

  it("muestra el error del servidor y no guarda copia en un 500", async () => {
    mockFetch.mockResolvedValue(response(500, { error: "Error interno" }));
    await expect(service.obtenerQR("123")).rejects.toThrow("Error interno");
    expect(mockDisk.has(CACHE)).toBe(false);
  });

  it("rechaza un id con formato inválido sin llamar a la red", async () => {
    await expect(service.obtenerQR("../x")).rejects.toThrow("no es válido");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rechaza una respuesta con visita_id distinto al solicitado", async () => {
    mockFetch.mockResolvedValue(
      response(200, { success: true, data: { ...qr, visita_id: 999 } }),
    );
    await expect(service.obtenerQR("123")).rejects.toThrow("no es válida");
    expect(mockDisk.has(CACHE)).toBe(false);
  });
});

describe("QR sin conexión", () => {
  it("falla con mensaje de conexión y la copia guardada sigue disponible", async () => {
    await guardar();
    mockFetch.mockRejectedValue(new TypeError("Network request failed"));
    await expect(service.obtenerQR("123")).rejects.toThrow(
      "No se pudo conectar",
    );
    await expect(service.obtenerQRGuardado("123")).resolves.toMatchObject({
      visita_id: 123,
      qr: "token-qr",
    });
  });

  it("sin copia guardada no hay QR que mostrar", async () => {
    mockFetch.mockRejectedValue(new TypeError("offline"));
    await expect(service.obtenerQR("123")).rejects.toThrow(
      "No se pudo conectar",
    );
    expect(await service.obtenerQRGuardado()).toBeNull();
  });

  it("al vencer el QR guardado ya no se ofrece y se elimina", async () => {
    await guardar();
    jest.setSystemTime(Date.parse(qr.vigente_hasta) + 1000);
    expect(await service.obtenerQRGuardado("123")).toBeNull();
    expect(mockDisk.has(CACHE)).toBe(false);
  });

  it("no entrega la copia de otra visita ni con un id inválido", async () => {
    await guardar();
    expect(await service.obtenerQRGuardado("124")).toBeNull();
    expect(await service.obtenerQRGuardado("abc")).toBeNull();
  });

  it("no entrega la copia si el JWT guardado ya venció", async () => {
    await guardar();
    mockDisk.set(TOKEN, jwt(1, now / 1000 - 10));
    expect(await service.obtenerQRGuardado()).toBeNull();
  });
});

describe("Cierre de sesión y QR", () => {
  it("después de cerrar sesión no queda JWT, identidad ni QR, aunque no haya red", async () => {
    await guardar();
    mockFetch.mockRejectedValue(new TypeError("offline"));
    await service.logout();
    expect(mockDisk.size).toBe(0);
    expect(await service.obtenerQRGuardado()).toBeNull();
  });

  it("revoca la sesión en el servidor con POST y el JWT vigente", async () => {
    await guardar();
    mockFetch.mockResolvedValue(response(200, {}));
    await service.logout();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/visitants/me/logout"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: `Bearer ${jwt()}` }),
      }),
    );
  });

  it("tras cerrar sesión, otra cuenta que inicia sesión no ve el QR anterior", async () => {
    await guardar();
    mockFetch.mockResolvedValue(response(200, {}));
    await service.logout();
    mockFetch.mockResolvedValue(
      response(200, { token: jwt(2), visitante: { id: 2 } }),
    );
    await service.login({ correo: "otro@example.test", password: "prueba" });
    expect(await service.obtenerQRGuardado()).toBeNull();
  });
});

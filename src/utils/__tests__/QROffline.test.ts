const mockDisk = new Map<string, string>();
const mockGet = jest.fn(async (key: string) => mockDisk.get(key) ?? null);
const mockSet = jest.fn(async (key: string, value: string) => { mockDisk.set(key, value); });
const mockDelete = jest.fn(async (key: string) => { mockDisk.delete(key); });
const mockPush = jest.fn(async (): Promise<string | null> => null);
jest.mock("expo-secure-store", () => ({
  getItemAsync: mockGet, setItemAsync: mockSet, deleteItemAsync: mockDelete,
}));
jest.mock("../../services/NotificacionesService", () => ({
  NotificacionesService: { tokenGuardado: mockPush, guardarToken: jest.fn(), olvidarToken: jest.fn() },
}));

const TOKEN = "kairos_visitante_token";
const CACHE = "kairos_ultimo_qr";
const SESSION = "kairos_qr_sesion";
const now = Date.parse("2026-11-07T18:00:00Z");
const qr = {
  visita_id: 123, folio: "KV-000123", qr: "token-qr", estado_qr: "valido" as const,
  vigente_desde: "2026-11-07T17:30:00.000Z", vigente_hasta: "2026-11-07T18:30:00.000Z",
};
const jwt = (user = 1, exp = now / 1000 + 3600) => `e30.${btoa(JSON.stringify({ sub: user, exp }))}.firma`;
const response = (status: number, data: unknown) => ({
  status, ok: status >= 200 && status < 300, json: async () => data,
});
let service: typeof import("../../services/VisitasService").VisitasService;
let cache: typeof import("../../services/QRCacheService").QRCacheService;
const mockFetch = jest.fn();
const originalFetch = global.fetch;
function cargarModulos() {
  jest.resetModules();
  service = jest.requireActual<typeof import("../../services/VisitasService")>("../../services/VisitasService").VisitasService;
  cache = jest.requireActual<typeof import("../../services/QRCacheService")>("../../services/QRCacheService").QRCacheService;
}
async function guardar() {
  mockFetch.mockResolvedValue(response(200, { success: true, data: qr }));
  await service.obtenerQR("123");
}
beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(now);
  mockDisk.clear(); mockGet.mockClear(); mockSet.mockClear(); mockDelete.mockClear(); mockPush.mockClear();
  mockGet.mockImplementation(async key => mockDisk.get(key) ?? null);
  mockSet.mockImplementation(async (key, value) => { mockDisk.set(key, value); });
  mockDelete.mockImplementation(async key => { mockDisk.delete(key); });
  mockPush.mockResolvedValue(null); mockFetch.mockReset();
  global.fetch = mockFetch;
  mockDisk.set(TOKEN, jwt()); cargarModulos();
});
afterEach(() => { jest.useRealTimers(); global.fetch = originalFetch; });

it("persiste un único QR mínimo y lo recupera después de reiniciar sin red", async () => {
  await guardar();
  const registro = JSON.parse(mockDisk.get(CACHE)!);
  expect(Object.keys(registro).sort()).toEqual([
    "version", "sesion", "visita_id", "folio", "qr", "vigente_desde", "vigente_hasta", "ultima_comprobacion",
  ].sort());
  expect(mockDisk.get(CACHE)).not.toContain(jwt());
  cargarModulos(); mockFetch.mockRejectedValue(new TypeError("offline"));
  await expect(service.obtenerQR("123")).rejects.toThrow("No se pudo conectar");
  await expect(service.obtenerQRGuardado("123")).resolves.toMatchObject({ ...qr, ultima_comprobacion: now });
  mockFetch.mockResolvedValue(response(200, { success: true, data: { ...qr, visita_id: 124, qr: "nuevo" } }));
  await service.obtenerQR("124");
  expect(await service.obtenerQRGuardado("123")).toBeNull();
  expect((await service.obtenerQRGuardado())?.visita_id).toBe(124);
});

it.each(["corrupta", "version", "sesion", "fecha", "token", "orden"])("rechaza caché %s", async cambio => {
  await guardar();
  const r = JSON.parse(mockDisk.get(CACHE)!);
  if (cambio === "version") r.version = 2;
  if (cambio === "sesion") r.sesion = "otra";
  if (cambio === "fecha") r.vigente_desde = "2026-02-30T12:00:00.000Z";
  if (cambio === "token") r.qr = " ";
  if (cambio === "orden") r.vigente_desde = r.vigente_hasta;
  mockDisk.set(CACHE, cambio === "corrupta" ? "{" : JSON.stringify(r));
  expect(await service.obtenerQRGuardado()).toBeNull();
});

it("no recupera caché sin JWT o identidad local", async () => {
  await guardar(); mockDisk.delete(TOKEN);
  expect(await service.obtenerQRGuardado()).toBeNull();
  mockDisk.set(TOKEN, jwt()); mockDisk.delete(SESSION);
  expect(await service.obtenerQRGuardado()).toBeNull();
});

it.each([-1, 0, 1])("conserva el límite final inclusivo: desplazamiento %s ms", async delta => {
  await guardar(); jest.setSystemTime(Date.parse(qr.vigente_hasta) + delta);
  expect(!!(await service.obtenerQRGuardado())).toBe(delta <= 0);
  if (delta > 0) expect(mockDisk.has(CACHE)).toBe(false);
});

it("rechaza un retroceso del reloj", async () => {
  await guardar(); jest.setSystemTime(now - 1);
  expect(await service.obtenerQRGuardado()).toBeNull();
});

it.each(["usado", "expirado"])("elimina la copia al recibir %s", async estado_qr => {
  await guardar();
  mockFetch.mockResolvedValue(response(200, { success: true, data: { ...qr, estado_qr, qr: null } }));
  expect((await service.obtenerQR("123")).estado_qr).toBe(estado_qr);
  expect(mockDisk.has(CACHE)).toBe(false);
});

it("el estado terminal de otra visita no borra el último QR", async () => {
  await guardar();
  mockFetch.mockResolvedValue(response(200, { success: true, data: { ...qr, visita_id: 124, estado_qr: "usado", qr: null } }));
  await service.obtenerQR("124");
  expect((await service.obtenerQRGuardado())?.visita_id).toBe(123);
});

it("logout limpia JWT, identidad y QR aunque falle push sin Internet", async () => {
  await guardar(); mockPush.mockResolvedValue("push"); mockFetch.mockRejectedValue(new TypeError("offline"));
  await service.logout();
  expect(mockDisk.size).toBe(0);
  expect(await service.obtenerQRGuardado()).toBeNull();
});

it("un nuevo login no puede recuperar el QR del usuario anterior", async () => {
  await guardar(); const anterior = mockDisk.get(SESSION);
  mockFetch.mockResolvedValue(response(200, { token: jwt(2), visitante: { id: 2 } }));
  await service.login({ correo: "otro@example.test", password: "prueba" });
  expect(await service.obtenerQRGuardado()).toBeNull();
  await guardar(); expect(mockDisk.get(SESSION)).not.toBe(anterior);
});

it.each(["401", "expirada", "ausente"])("limpia datos por sesión %s", async causa => {
  await guardar();
  if (causa === "401") {
    mockFetch.mockResolvedValue(response(401, {}));
    await expect(service.obtenerQR("123")).rejects.toThrow("sesión expiró");
  } else {
    if (causa === "ausente") mockDisk.delete(TOKEN);
    else mockDisk.set(TOKEN, jwt(1, now / 1000));
    expect(await service.restaurarSesion()).toBe(false);
  }
  expect(mockDisk.size).toBe(0);
});

it.each(["logout", "login"])("descarta una respuesta QR tardía tras %s", async cambio => {
  let resolver!: (value: unknown) => void;
  mockFetch.mockReturnValueOnce(new Promise(resolve => { resolver = resolve; }));
  const pendiente = service.obtenerQR("123");
  const verificacion = expect(pendiente).rejects.toMatchObject({ name: "AbortError" });
  await Promise.resolve(); await Promise.resolve();
  if (cambio === "logout") await service.logout();
  else {
    mockFetch.mockResolvedValue(response(200, { token: jwt(2), visitante: { id: 2 } }));
    await service.login({ correo: "otro@example.test", password: "prueba" });
  }
  resolver(response(200, { success: true, data: qr })); await verificacion;
  expect(mockDisk.has(CACHE)).toBe(false);
});

it("un 401 tardío no borra la nueva sesión", async () => {
  let resolver!: (value: unknown) => void;
  mockFetch.mockReturnValueOnce(new Promise(resolve => { resolver = resolve; }));
  const pendiente = service.obtenerQR("123");
  const verificacion = expect(pendiente).rejects.toMatchObject({ name: "AbortError" });
  await Promise.resolve(); await Promise.resolve();
  mockFetch.mockResolvedValue(response(200, { token: jwt(2), visitante: { id: 2 } }));
  await service.login({ correo: "otro@example.test", password: "prueba" });
  resolver(response(401, {})); await verificacion;
  expect(mockDisk.get(TOKEN)).toBe(jwt(2));
});

it("serializa una escritura en curso con logout", async () => {
  let liberar!: () => void;
  let notificar!: () => void;
  const escribiendo = new Promise<void>(resolve => { notificar = resolve; });
  mockSet.mockImplementation(async (key, value) => {
    if (key === CACHE) { notificar(); await new Promise<void>(resolve => { liberar = resolve; }); }
    mockDisk.set(key, value);
  });
  const pendiente = guardar();
  const verificacion = expect(pendiente).rejects.toMatchObject({ name: "AbortError" });
  await escribiendo;
  const salida = service.logout(); liberar();
  await salida; await verificacion;
  expect(mockDisk.size).toBe(0);
});

it("una escritura fallida no impide el QR online", async () => {
  mockSet.mockRejectedValue(new Error("storage"));
  await expect(guardar()).resolves.toBeUndefined();
  expect(await service.obtenerQRGuardado()).toBeNull();
});

it("una lectura fallida no expone datos", async () => {
  await guardar(); mockGet.mockRejectedValue(new Error("storage"));
  expect(await service.obtenerQRGuardado()).toBeNull();
});

it("si falla eliminar un QR usado, invalida la identidad también tras reiniciar", async () => {
  await guardar();
  mockDelete.mockImplementation(async key => { if (key === CACHE) throw new Error("storage"); mockDisk.delete(key); });
  mockFetch.mockResolvedValue(response(200, { success: true, data: { ...qr, estado_qr: "usado", qr: null } }));
  await service.obtenerQR("123"); cargarModulos();
  expect(await service.obtenerQRGuardado()).toBeNull();
});

it("logout informa fallos de borrado e intenta eliminar todas las claves", async () => {
  await guardar(); mockDelete.mockRejectedValue(new Error("storage"));
  await expect(service.logout()).rejects.toThrow("No se pudieron eliminar");
  for (const key of [TOKEN, SESSION, CACHE]) expect(mockDelete).toHaveBeenCalledWith(key);
  expect(await service.obtenerQRGuardado()).toBeNull();
});

it("la revocación impide escrituras capturadas antes de cambiar de sesión", async () => {
  const origen = cache.generacion(); cache.revocar(); await cache.limpiar(); cache.habilitar();
  await cache.guardar(qr, origen);
  expect(mockDisk.has(CACHE)).toBe(false);
});

it("conserva el registro push y su desvinculación con el JWT vigente", async () => {
  mockFetch.mockResolvedValue(response(200, {}));
  await service.registrarTokenPush("push", "android", service.generacionSesionPush());
  expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/api/visitants/me/push-token"), expect.objectContaining({
    method: "POST", headers: expect.objectContaining({ Authorization: `Bearer ${jwt()}` }),
    body: JSON.stringify({ token: "push", plataforma: "android" }),
  }));
  mockPush.mockResolvedValue("push"); await service.logout();
  expect(mockFetch).toHaveBeenNthCalledWith(2, expect.stringContaining("/api/visitants/me/push-token"), expect.objectContaining({
    method: "DELETE", headers: expect.objectContaining({ Authorization: `Bearer ${jwt()}` }),
  }));
  expect(mockFetch).toHaveBeenLastCalledWith(expect.stringContaining("/api/visitants/me/logout"), expect.objectContaining({
    method: "POST", headers: expect.objectContaining({ Authorization: `Bearer ${jwt()}` }),
  }));
  expect(mockDisk.size).toBe(0);
});

it("no persiste contratos inválidos ni errores HTTP", async () => {
  mockFetch.mockResolvedValue(response(200, { success: true, data: { ...qr, qr: null } }));
  await expect(service.obtenerQR("123")).rejects.toThrow("respuesta");
  mockFetch.mockResolvedValue(response(403, { error: "Prohibido" }));
  await expect(service.obtenerQR("123")).rejects.toThrow("Prohibido");
  expect(mockSet).not.toHaveBeenCalled();
});

it("una cancelación intencional no se clasifica como error de conexión", async () => {
  const controller = new AbortController(); controller.abort();
  mockFetch.mockRejectedValue(new TypeError("aborted"));
  await expect(service.obtenerQR("123", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  expect(mockDisk.has(CACHE)).toBe(false);
});

it("invalida la identidad si no se puede leer la copia que el servidor marcó usada", async () => {
  await guardar();
  mockGet.mockImplementation(async key => { if (key === CACHE) throw new Error("storage"); return mockDisk.get(key) ?? null; });
  mockFetch.mockResolvedValue(response(200, { success: true, data: { ...qr, estado_qr: "usado", qr: null } }));
  await service.obtenerQR("123");
  expect(mockDisk.has(SESSION)).toBe(false);
});

it("un fallo al borrar por 401 se comunica como sesión expirada con limpieza incompleta", async () => {
  await guardar(); mockDelete.mockRejectedValue(new Error("storage"));
  mockFetch.mockResolvedValue(response(401, {}));
  await expect(service.obtenerQR("123")).rejects.toThrow("No se pudieron eliminar");
  expect(await service.obtenerQRGuardado()).toBeNull();
});

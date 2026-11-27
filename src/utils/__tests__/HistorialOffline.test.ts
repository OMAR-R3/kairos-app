import type { Visita } from "../../services/VisitasService";

const mockDisco = new Map<string, string>();
const mockLeer = jest.fn(async (clave: string) => mockDisco.get(clave) ?? null);
const mockGuardar = jest.fn(async (clave: string, valor: string) => { mockDisco.set(clave, valor); });
const mockBorrar = jest.fn(async (clave: string) => { mockDisco.delete(clave); });

jest.mock("expo-secure-store", () => ({
  getItemAsync: mockLeer, setItemAsync: mockGuardar, deleteItemAsync: mockBorrar,
}));
jest.mock("../../services/NotificacionesService", () => ({
  NotificacionesService: {
    tokenGuardado: jest.fn(async () => null),
    olvidarToken: jest.fn(),
  },
}));

const TOKEN = "kairos_visitante_token";
const CACHE = "kairos_historial_visitas";
const ahora = Date.parse("2026-11-24T18:00:00Z");
const jwt = (sub: number, exp = ahora / 1000 + 3600) =>
  `e30.${btoa(JSON.stringify({ sub, exp }))}.firma`;
const visita: Visita = {
  id: 123, depto_id: 2, fecha: "2026-11-25", hora_inicio: "09:00:00",
  motivo: "Reunión", estado: "pendiente", departamento: { id: 2, nombre: "Vinculación" },
};
const otraVisita = { ...visita, id: 124 };
const respuesta = (status: number, body: unknown) => ({
  status, ok: status >= 200 && status < 300, json: async () => body,
});
const mockFetch = jest.fn();
const fetchOriginal = global.fetch;

function cargarServicio() {
  jest.resetModules();
  return jest.requireActual<typeof import("../../services/VisitasService")>("../../services/VisitasService");
}

let modulo: ReturnType<typeof cargarServicio>;
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(ahora);
  mockDisco.clear();
  jest.clearAllMocks();
  mockFetch.mockReset();
  mockDisco.set(TOKEN, jwt(1));
  global.fetch = mockFetch;
  modulo = cargarServicio();
});
afterEach(() => {
  global.fetch = fetchOriginal;
  jest.useRealTimers();
});

async function sincronizar(visitas: Visita[] = [visita]) {
  mockFetch.mockResolvedValueOnce(respuesta(200, { data: visitas }));
  await expect(modulo.VisitasService.obtenerMisVisitas()).resolves.toEqual(visitas);
}

function sinConexion() {
  mockFetch.mockRejectedValueOnce(new TypeError("Network request failed"));
}

it("guarda la lista válida con el titular y sin duplicar el JWT ni campos ajenos al historial", async () => {
  mockFetch.mockResolvedValueOnce(respuesta(200, [{ ...visita, datoAjeno: "privado" }]));
  await modulo.VisitasService.obtenerMisVisitas();
  expect(JSON.parse(mockDisco.get(CACHE)!)).toEqual({ version: 1, titular: "1", visitas: [visita] });
  expect(mockDisco.get(CACHE)).not.toContain(jwt(1));
});

it("reemplaza la lista anterior con una consulta nueva", async () => {
  await sincronizar();
  await sincronizar([otraVisita]);
  sinConexion();
  await expect(modulo.VisitasService.obtenerMisVisitas()).resolves.toEqual([otraVisita]);
});

it("una lista vacía reemplaza los registros y sigue disponible sin conexión", async () => {
  await sincronizar();
  await sincronizar([]);
  sinConexion();
  await expect(modulo.VisitasService.obtenerMisVisitas()).resolves.toEqual([]);
});

it.each([[null], [{}], [{ success: false, data: [] }], [[{ ...visita, fecha: null }]]])(
  "rechaza una respuesta inválida sin sobrescribir el historial",
  async body => {
    await sincronizar();
    mockFetch.mockResolvedValueOnce(respuesta(200, body));
    await expect(modulo.VisitasService.obtenerMisVisitas()).rejects.toThrow("No se pudieron cargar las visitas");
    sinConexion();
    await expect(modulo.VisitasService.obtenerMisVisitas()).resolves.toEqual([visita]);
  },
);

it("acepta la forma real de /api/visits/me, sin depto_id y con el departamento anidado", async () => {
  const { depto_id: _omitido, ...base } = visita;
  const real = { ...base, folio: "KV-000123", departamento: { id: 2, nombre: "Vinculación", ubicacion: "Edificio C" } };
  mockFetch.mockResolvedValueOnce(respuesta(200, { success: true, data: [real] }));
  await expect(modulo.VisitasService.obtenerMisVisitas()).resolves.toEqual([real]);
  sinConexion();
  await expect(modulo.VisitasService.obtenerMisVisitas()).resolves.toEqual([base]);
});

it("rechaza una visita sin depto_id y sin departamento", async () => {
  const { depto_id: _omitido, departamento: _depto, ...sinDepto } = visita;
  mockFetch.mockResolvedValueOnce(respuesta(200, { data: [sinDepto] }));
  await expect(modulo.VisitasService.obtenerMisVisitas()).rejects.toThrow("No se pudieron cargar las visitas");
});

it("devuelve los datos del servidor si falla la escritura", async () => {
  mockGuardar.mockRejectedValueOnce(new Error("Almacenamiento no disponible"));
  await sincronizar();
});

it("recupera la última lista al reiniciar sin conexión", async () => {
  await sincronizar();
  modulo = cargarServicio();
  sinConexion();
  await expect(modulo.VisitasService.obtenerMisVisitas()).resolves.toEqual([visita]);
});

it("conserva el error de conexión sin una lista sincronizada", async () => {
  sinConexion();
  await expect(modulo.VisitasService.obtenerMisVisitas()).rejects.toThrow(
    "No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.",
  );
});

it.each(["{", JSON.stringify({ version: 1, titular: "1", visitas: [{ id: 123 }] })])(
  "ignora un registro corrupto sin ocultar el error de conexión",
  async raw => {
    mockDisco.set(CACHE, raw);
    sinConexion();
    await expect(modulo.VisitasService.obtenerMisVisitas()).rejects.toBeInstanceOf(modulo.ErrorConexion);
  },
);

it.each([403, 500])("conserva el HTTP %s aunque exista caché", async status => {
  await sincronizar();
  mockLeer.mockClear();
  mockFetch.mockResolvedValueOnce(respuesta(status, { error: "Error del servidor" }));
  await expect(modulo.VisitasService.obtenerMisVisitas()).rejects.toThrow("Error del servidor");
  expect(mockLeer.mock.calls.map(([clave]) => clave)).not.toContain(CACHE);
  expect(mockDisco.has(CACHE)).toBe(true);
});

it("un 401 conserva el error de sesión, omite la recuperación y elimina la caché", async () => {
  await sincronizar();
  mockLeer.mockClear();
  mockFetch.mockResolvedValueOnce(respuesta(401, {}));
  await expect(modulo.VisitasService.obtenerMisVisitas()).rejects.toBeInstanceOf(modulo.SesionExpiradaError);
  expect(mockLeer.mock.calls.map(([clave]) => clave)).not.toContain(CACHE);
  expect(mockDisco.has(CACHE)).toBe(false);
});

it("una cuenta diferente no recupera el historial anterior, aunque el archivo todavía exista", async () => {
  await sincronizar();
  mockDisco.set(TOKEN, jwt(2));
  modulo = cargarServicio();
  sinConexion();
  await expect(modulo.VisitasService.obtenerMisVisitas()).rejects.toBeInstanceOf(modulo.ErrorConexion);
});

it("un JWT vencido no habilita la lectura del historial", async () => {
  await sincronizar();
  mockDisco.set(TOKEN, jwt(1, ahora / 1000));
  mockLeer.mockClear();
  sinConexion();
  await expect(modulo.VisitasService.obtenerMisVisitas()).rejects.toBeInstanceOf(modulo.ErrorConexion);
  expect(mockLeer.mock.calls.map(([clave]) => clave)).not.toContain(CACHE);
});

it("el cierre de sesión sin conexión elimina la lista guardada", async () => {
  await sincronizar();
  sinConexion();
  await modulo.VisitasService.logout();
  expect(mockDisco.has(CACHE)).toBe(false);
});

it("una respuesta pendiente no vuelve a guardar datos tras cerrar sesión", async () => {
  await sincronizar();
  let responder!: (valor: ReturnType<typeof respuesta>) => void;
  const pendiente = new Promise<ReturnType<typeof respuesta>>(resolve => { responder = resolve; });
  mockFetch.mockReturnValueOnce(pendiente).mockResolvedValueOnce(respuesta(200, {}));
  const consulta = modulo.VisitasService.obtenerMisVisitas();
  await Promise.resolve();
  expect(mockFetch).toHaveBeenLastCalledWith(expect.stringMatching(/\/api\/visits\/me$/), expect.anything());

  await modulo.VisitasService.logout();
  responder(respuesta(200, { data: [otraVisita] }));
  await expect(consulta).rejects.toMatchObject({ name: "AbortError" });
  expect(mockDisco.has(CACHE)).toBe(false);
});

it("la limpieza espera una escritura en curso y borra su resultado", async () => {
  let terminar!: () => void;
  let avisarInicio!: () => void;
  const escrituraIniciada = new Promise<void>(resolve => { avisarInicio = resolve; });
  mockGuardar.mockImplementationOnce((clave, valor) => new Promise<void>(resolve => {
    terminar = () => { mockDisco.set(clave, valor); resolve(); };
    avisarInicio();
  }));
  mockFetch.mockResolvedValueOnce(respuesta(200, { data: [visita] })).mockResolvedValueOnce(respuesta(200, {}));
  const consulta = modulo.VisitasService.obtenerMisVisitas();
  await escrituraIniciada;

  const cierre = modulo.VisitasService.logout();
  terminar();
  await expect(consulta).rejects.toMatchObject({ name: "AbortError" });
  await cierre;
  expect(mockDisco.has(CACHE)).toBe(false);
});

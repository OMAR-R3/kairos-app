// Pruebas del registro y borrado del token push en VisitasService.
// El estado interno del servicio (generación de sesión, cola) vive a nivel de
// módulo, así que cada prueba carga una copia nueva con jest.resetModules().

const API = "https://api.test";
process.env.EXPO_PUBLIC_API_URL = API;

const mockAlmacen = new Map<string, string>();
const mockNotificaciones = {
  guardarToken: jest.fn(async (t: string) => {
    mockAlmacen.set("push", t);
  }),
  tokenGuardado: jest.fn(async () => mockAlmacen.get("push") ?? null),
  olvidarToken: jest.fn(async () => {
    mockAlmacen.delete("push");
  }),
};

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (k: string) => mockAlmacen.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mockAlmacen.set(k, v);
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    mockAlmacen.delete(k);
  }),
}));
jest.mock("../../services/NotificacionesService", () => ({
  NotificacionesService: mockNotificaciones,
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

const respuesta = (status: number, body: unknown = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

// JWT de prueba: solo importa la fecha de expiración (exp, en segundos).
const jwt = (expEnSegundos: number) =>
  `h.${Buffer.from(JSON.stringify({ exp: expEnSegundos })).toString("base64url")}.s`;
const VIGENTE = () => jwt(Math.floor(Date.now() / 1000) + 3600);
const VENCIDO = () => jwt(Math.floor(Date.now() / 1000) - 3600);

const TOKEN_PUSH = "ExponentPushToken[abc123]";
let VisitasService: typeof import("@/services/VisitasService").VisitasService;

beforeEach(() => {
  jest.resetModules();
  mockAlmacen.clear();
  jest.clearAllMocks();
  mockFetch.mockReset();
  mockAlmacen.set("kairos_visitante_token", VIGENTE());
  VisitasService = require("@/services/VisitasService").VisitasService;
});

describe("registrarTokenPush", () => {
  it("envía POST con el token, la plataforma y el JWT del visitante", async () => {
    mockFetch.mockResolvedValue(respuesta(200));
    const gen = VisitasService.generacionSesionPush();

    await VisitasService.registrarTokenPush(TOKEN_PUSH, "android", gen);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opciones] = mockFetch.mock.calls[0];
    expect(url).toContain("push-token");
    expect(opciones.method).toBe("POST");
    expect(JSON.parse(opciones.body)).toEqual({ token: TOKEN_PUSH, plataforma: "android" });
    expect(opciones.headers.Authorization).toBe(
      `Bearer ${mockAlmacen.get("kairos_visitante_token")}`
    );
  });

  it("guarda el token en el teléfono para poder borrarlo después", async () => {
    mockFetch.mockResolvedValue(respuesta(200));

    await VisitasService.registrarTokenPush(
      TOKEN_PUSH,
      "ios",
      VisitasService.generacionSesionPush()
    );

    expect(mockNotificaciones.guardarToken).toHaveBeenCalledWith(TOKEN_PUSH);
  });

  it("no vuelve a registrar el mismo token", async () => {
    mockFetch.mockResolvedValue(respuesta(200));
    const gen = VisitasService.generacionSesionPush();

    await VisitasService.registrarTokenPush(TOKEN_PUSH, "android", gen);
    await VisitasService.registrarTokenPush(TOKEN_PUSH, "android", gen);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("registra otra vez si el token cambió", async () => {
    mockFetch.mockResolvedValue(respuesta(200));
    const gen = VisitasService.generacionSesionPush();

    await VisitasService.registrarTokenPush(TOKEN_PUSH, "android", gen);
    await VisitasService.registrarTokenPush("ExponentPushToken[nuevo]", "android", gen);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("no hace nada si no hay sesión iniciada", async () => {
    mockAlmacen.delete("kairos_visitante_token");

    await VisitasService.registrarTokenPush(
      TOKEN_PUSH,
      "android",
      VisitasService.generacionSesionPush()
    );

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("no hace nada si el JWT ya venció", async () => {
    mockAlmacen.set("kairos_visitante_token", VENCIDO());

    await VisitasService.registrarTokenPush(
      TOKEN_PUSH,
      "android",
      VisitasService.generacionSesionPush()
    );

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("descarta el registro si la sesión cambió mientras se pedía el token", async () => {
    const generacionVieja = VisitasService.generacionSesionPush();
    mockFetch.mockResolvedValue(respuesta(200, { token: VIGENTE(), visitante: { id: 1 } }));
    await VisitasService.login({ correo: "a@a.com", password: "x" }); // sube la generación
    mockFetch.mockClear();

    await VisitasService.registrarTokenPush(TOKEN_PUSH, "android", generacionVieja);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("con 401 lanza error pero NO cierra la sesión del visitante", async () => {
    mockFetch.mockResolvedValue(respuesta(401));
    const SecureStore = require("expo-secure-store");

    await expect(
      VisitasService.registrarTokenPush(
        TOKEN_PUSH,
        "android",
        VisitasService.generacionSesionPush()
      )
    ).rejects.toThrow("No se pudo sincronizar el token de notificaciones");

    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith("kairos_visitante_token");
    expect(mockAlmacen.has("kairos_visitante_token")).toBe(true);
  });

  it("con error del servidor lanza el mensaje de sincronización", async () => {
    mockFetch.mockResolvedValue(respuesta(500));

    await expect(
      VisitasService.registrarTokenPush(
        TOKEN_PUSH,
        "android",
        VisitasService.generacionSesionPush()
      )
    ).rejects.toThrow("No se pudo sincronizar el token de notificaciones");
  });

  it("con fallo de red lanza el mensaje amigable de conexión", async () => {
    mockFetch.mockRejectedValue(new TypeError("Network request failed"));

    await expect(
      VisitasService.registrarTokenPush(
        TOKEN_PUSH,
        "android",
        VisitasService.generacionSesionPush()
      )
    ).rejects.toThrow("No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.");
  });
});

describe("eliminarTokenPush", () => {
  it("envía DELETE con el token y lo olvida en el teléfono", async () => {
    mockFetch.mockResolvedValue(respuesta(200));
    mockAlmacen.set("push", TOKEN_PUSH);

    await VisitasService.eliminarTokenPush(TOKEN_PUSH, VisitasService.generacionSesionPush());

    const [url, opciones] = mockFetch.mock.calls[0];
    expect(url).toContain("push-token");
    expect(opciones.method).toBe("DELETE");
    expect(JSON.parse(opciones.body)).toEqual({ token: TOKEN_PUSH });
    expect(mockNotificaciones.olvidarToken).toHaveBeenCalled();
  });

  it("si el servidor falla conserva el token guardado para reintentar", async () => {
    mockFetch.mockResolvedValue(respuesta(500));
    mockAlmacen.set("push", TOKEN_PUSH);

    await expect(
      VisitasService.eliminarTokenPush(TOKEN_PUSH, VisitasService.generacionSesionPush())
    ).rejects.toThrow("No se pudo sincronizar el token de notificaciones");

    expect(mockNotificaciones.olvidarToken).not.toHaveBeenCalled();
  });

  it("no hace nada sin sesión iniciada", async () => {
    mockAlmacen.delete("kairos_visitante_token");

    await VisitasService.eliminarTokenPush(TOKEN_PUSH, VisitasService.generacionSesionPush());

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("logout y token push", () => {
  it("borra el token del backend y luego el JWT al cerrar sesión", async () => {
    mockFetch.mockResolvedValue(respuesta(200));
    mockAlmacen.set("push", TOKEN_PUSH);
    const jwtAntes = mockAlmacen.get("kairos_visitante_token");

    await VisitasService.logout();

    const [, opciones] = mockFetch.mock.calls[0];
    expect(opciones.method).toBe("DELETE");
    expect(opciones.headers.Authorization).toBe(`Bearer ${jwtAntes}`);
    expect(JSON.parse(opciones.body)).toEqual({ token: TOKEN_PUSH });
    expect(mockAlmacen.has("kairos_visitante_token")).toBe(false);
  });

  it("sin token push guardado solo cierra la sesión", async () => {
    await VisitasService.logout();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockAlmacen.has("kairos_visitante_token")).toBe(false);
  });

  it("aunque falle el borrado en el backend, la sesión se cierra igual", async () => {
    mockFetch.mockRejectedValue(new TypeError("Network request failed"));
    mockAlmacen.set("push", TOKEN_PUSH);

    await expect(VisitasService.logout()).resolves.toBeUndefined();

    expect(mockAlmacen.has("kairos_visitante_token")).toBe(false);
  });

  it("después de cerrar sesión ya no se registra ningún token", async () => {
    const gen = VisitasService.generacionSesionPush();
    await VisitasService.logout();
    mockAlmacen.set("kairos_visitante_token", VIGENTE());
    mockFetch.mockClear();

    await VisitasService.registrarTokenPush(TOKEN_PUSH, "android", gen);

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

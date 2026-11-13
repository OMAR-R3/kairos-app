import {
  CodigoInvalidoError,
  DemasiadosIntentosError,
  LookupService,
  SesionLookupExpiradaError,
} from "@/services/LookupService";

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

const respuesta = (status: number, body: unknown) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

describe("LookupService", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    LookupService.limpiar();
  });

  // ── solicitarCodigo ─────────────────────────────────────────────────

  it("solicita codigo y guarda challenge en memoria", async () => {
    mockFetch.mockResolvedValue(
      respuesta(202, { challengeId: "ch-1", browserSecret: "sec-1" }),
    );
    await LookupService.solicitarCodigo("test@correo.com");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/visits/lookup/request-code");
    expect(JSON.parse(opts.body)).toEqual({ correo: "test@correo.com" });
  });

  it("lanza DemasiadosIntentosError en 429 al solicitar codigo", async () => {
    mockFetch.mockResolvedValue(respuesta(429, {}));
    await expect(
      LookupService.solicitarCodigo("test@correo.com"),
    ).rejects.toBeInstanceOf(DemasiadosIntentosError);
  });

  it("lanza error generico en fallo de red al solicitar codigo", async () => {
    mockFetch.mockRejectedValue(new TypeError("Network error"));
    await expect(
      LookupService.solicitarCodigo("test@correo.com"),
    ).rejects.toThrow("No se pudo conectar");
  });

  // ── verificarCodigo ─────────────────────────────────────────────────

  it("verifica codigo y guarda sesion en memoria", async () => {
    // Primero solicitar codigo
    mockFetch.mockResolvedValueOnce(
      respuesta(202, { challengeId: "ch-2", browserSecret: "sec-2" }),
    );
    await LookupService.solicitarCodigo("user@mail.com");

    // Verificar
    mockFetch.mockResolvedValueOnce(
      respuesta(200, { accessToken: "tok-abc", expiresIn: 900 }),
    );
    await LookupService.verificarCodigo("12345678");

    expect(LookupService.sesionActiva()).toBe(true);
    expect(LookupService.correoActivo()).toBe("user@mail.com");
    expect(LookupService.tiempoRestante()).toBeGreaterThan(890);
  });

  it("lanza error si se intenta verificar sin solicitar primero", async () => {
    await expect(
      LookupService.verificarCodigo("12345678"),
    ).rejects.toThrow("Primero solicita");
  });

  it("lanza CodigoInvalidoError en 401 al verificar", async () => {
    mockFetch.mockResolvedValueOnce(
      respuesta(202, { challengeId: "ch-3", browserSecret: "sec-3" }),
    );
    await LookupService.solicitarCodigo("a@b.com");

    mockFetch.mockResolvedValueOnce(
      respuesta(401, { error: "Codigo incorrecto" }),
    );
    await expect(
      LookupService.verificarCodigo("00000000"),
    ).rejects.toBeInstanceOf(CodigoInvalidoError);
  });

  it("lanza DemasiadosIntentosError en 429 al verificar", async () => {
    mockFetch.mockResolvedValueOnce(
      respuesta(202, { challengeId: "ch-4", browserSecret: "sec-4" }),
    );
    await LookupService.solicitarCodigo("a@b.com");

    mockFetch.mockResolvedValueOnce(respuesta(429, {}));
    await expect(
      LookupService.verificarCodigo("11111111"),
    ).rejects.toBeInstanceOf(DemasiadosIntentosError);
  });

  // ── obtenerHistorial ────────────────────────────────────────────────

  it("obtiene historial con token lookup", async () => {
    // Setup: solicitar + verificar
    mockFetch.mockResolvedValueOnce(
      respuesta(202, { challengeId: "ch-5", browserSecret: "sec-5" }),
    );
    await LookupService.solicitarCodigo("hist@mail.com");

    mockFetch.mockResolvedValueOnce(
      respuesta(200, { accessToken: "tok-hist", expiresIn: 900 }),
    );
    await LookupService.verificarCodigo("99999999");

    // Historial
    mockFetch.mockResolvedValueOnce(
      respuesta(200, { data: [{ id: 1, estado: "pendiente" }] }),
    );
    const visitas = await LookupService.obtenerHistorial();
    expect(visitas).toHaveLength(1);
    expect(visitas[0].id).toBe(1);

    const [url, opts] = mockFetch.mock.calls[2];
    expect(url).toContain("/api/visits/me");
    expect(url).toContain("correo=hist%40mail.com");
    expect(opts.headers.Authorization).toBe("Bearer tok-hist");
  });

  it("lanza SesionLookupExpiradaError sin sesion activa", async () => {
    await expect(LookupService.obtenerHistorial()).rejects.toBeInstanceOf(
      SesionLookupExpiradaError,
    );
  });

  it("lanza SesionLookupExpiradaError en 401 del historial", async () => {
    mockFetch.mockResolvedValueOnce(
      respuesta(202, { challengeId: "ch-6", browserSecret: "sec-6" }),
    );
    await LookupService.solicitarCodigo("exp@mail.com");

    mockFetch.mockResolvedValueOnce(
      respuesta(200, { accessToken: "tok-exp", expiresIn: 900 }),
    );
    await LookupService.verificarCodigo("88888888");

    mockFetch.mockResolvedValueOnce(respuesta(401, {}));
    await expect(LookupService.obtenerHistorial()).rejects.toBeInstanceOf(
      SesionLookupExpiradaError,
    );
    expect(LookupService.sesionActiva()).toBe(false);
  });

  // ── cerrarSesion ────────────────────────────────────────────────────

  it("cierra sesion y limpia estado", async () => {
    mockFetch.mockResolvedValueOnce(
      respuesta(202, { challengeId: "ch-7", browserSecret: "sec-7" }),
    );
    await LookupService.solicitarCodigo("close@mail.com");

    mockFetch.mockResolvedValueOnce(
      respuesta(200, { accessToken: "tok-close", expiresIn: 900 }),
    );
    await LookupService.verificarCodigo("77777777");
    expect(LookupService.sesionActiva()).toBe(true);

    mockFetch.mockResolvedValueOnce(respuesta(200, {}));
    await LookupService.cerrarSesion();
    expect(LookupService.sesionActiva()).toBe(false);
    expect(LookupService.correoActivo()).toBeNull();

    const [url, opts] = mockFetch.mock.calls[2];
    expect(url).toContain("/api/visits/lookup/logout");
    expect(opts.headers.Authorization).toBe("Bearer tok-close");
  });

  it("cerrarSesion no falla si no hay sesion", async () => {
    await expect(LookupService.cerrarSesion()).resolves.toBeUndefined();
  });

  // ── limpiar ─────────────────────────────────────────────────────────

  it("limpiar resetea todo el estado", async () => {
    mockFetch.mockResolvedValueOnce(
      respuesta(202, { challengeId: "ch-8", browserSecret: "sec-8" }),
    );
    await LookupService.solicitarCodigo("limpia@mail.com");

    mockFetch.mockResolvedValueOnce(
      respuesta(200, { accessToken: "tok-limpia", expiresIn: 900 }),
    );
    await LookupService.verificarCodigo("66666666");

    LookupService.limpiar();
    expect(LookupService.sesionActiva()).toBe(false);
    expect(LookupService.correoActivo()).toBeNull();
    expect(LookupService.tiempoRestante()).toBe(0);
  });
});

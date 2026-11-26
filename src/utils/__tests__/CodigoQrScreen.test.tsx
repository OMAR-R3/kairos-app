import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import { Alert, AppState } from "react-native";
import CodigoQrScreen from "../../app/codigo-qr";
import { ErrorConexion, SesionExpiradaError, VisitasService } from "../../services/VisitasService";

const mockReplace = jest.fn();
let mockId: string | string[] | undefined = "123";
const mockRouter = { replace: mockReplace };
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ id: mockId }),
  useFocusEffect: (callback: () => void) => { jest.requireActual<typeof React>("react").useEffect(callback, [callback]); },
}));
jest.mock("react-native-qrcode-svg", () => "QRCode");
jest.mock("../../services/VisitasService", () => {
  const actual = jest.requireActual("../../services/VisitasService");
  return { ...actual, VisitasService: { obtenerQR: jest.fn(), obtenerQRGuardado: jest.fn(), generacionSesionPush: jest.fn(() => 0) } };
});
const mockQR = VisitasService.obtenerQR as jest.Mock;
const mockGuardado = VisitasService.obtenerQRGuardado as jest.Mock;
const data = { visita_id: 123, folio: "KV-000123", qr: "token-real", estado_qr: "valido", vigente_desde: "2026-11-07T17:30:00.000Z", vigente_hasta: "2026-11-07T18:30:00.000Z" };
let screen: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers(); jest.setSystemTime(new Date("2026-11-07T18:00:00Z"));
  mockId = "123"; mockQR.mockReset(); mockReplace.mockReset();
  mockQR.mockResolvedValue(data);
  mockGuardado.mockReset(); mockGuardado.mockResolvedValue(null);
  (VisitasService.generacionSesionPush as jest.Mock).mockReturnValue(0);
  jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove: jest.fn() });
});
afterEach(async () => { if (screen) await act(async () => screen.unmount()); jest.restoreAllMocks(); jest.useRealTimers(); });
async function montar() { await act(async () => { screen = create(<CodigoQrScreen />); }); }
function codigos() { return screen.root.findAll(node => node.type === ("QRCode" as unknown)); }
async function pulsar(label: string) {
  const boton = screen.root.findByProps({ accessibilityLabel: label });
  await act(async () => { boton!.props.onPress(); });
}
it("renderiza el token real y vuelve al detalle correspondiente", async () => {
  await montar(); expect(codigos()[0].props.value).toBe("token-real");
  await pulsar("Volver");
  expect(mockReplace).toHaveBeenCalledWith({ pathname: "/detalle-visita/[id]", params: { id: "123" } });
});
it.each(["expirado", "usado"])("no renderiza códigos para %s", async estado_qr => {
  mockQR.mockResolvedValue({ ...data, estado_qr, qr: null }); await montar();
  expect(codigos()).toHaveLength(0);
  expect(JSON.stringify(screen.toJSON())).toContain(estado_qr === "usado" ? "Utilizado" : "Expirado");
});
it("oculta un código anticipado y lo habilita al comenzar la ventana", async () => {
  jest.setSystemTime(new Date("2026-11-07T17:29:59Z")); await montar();
  expect(codigos()).toHaveLength(0);
  await act(async () => { jest.advanceTimersByTime(1000); });
  expect(codigos()).toHaveLength(1);
});
it("desmonta el código al vencer sin otra consulta", async () => {
  jest.setSystemTime(new Date("2026-11-07T18:29:59Z")); await montar();
  await act(async () => { jest.advanceTimersByTime(1002); });
  expect(codigos()).toHaveLength(0); expect(mockQR).toHaveBeenCalledTimes(1);
});
it("no consulta con un id múltiple", async () => {
  mockId = ["123", "124"]; await montar(); expect(mockQR).not.toHaveBeenCalled();
});
it("limpia el QR al actualizar y descarta respuestas después de salir", async () => {
  await montar(); await act(async () => { jest.advanceTimersByTime(30000); });
  let resolver!: (value: unknown) => void;
  mockQR.mockReturnValue(new Promise(resolve => { resolver = resolve; }));
  await pulsar("Actualizar estado"); expect(codigos()).toHaveLength(0);
  await act(async () => { screen.unmount(); resolver(data); });
  expect(mockReplace).not.toHaveBeenCalled();
});
it("redirige al login cuando expira la sesión", async () => {
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  mockQR.mockRejectedValue(new SesionExpiradaError()); await montar();
  expect(mockReplace).toHaveBeenCalledWith("/");
});
it("muestra error de conexión y permite reintentar sin sondeo", async () => {
  mockQR.mockRejectedValueOnce(new Error("No se pudo conectar")); await montar();
  expect(JSON.stringify(screen.toJSON())).toContain("No se pudo conectar");
  await act(async () => { jest.advanceTimersByTime(30000); });
  expect(mockQR).toHaveBeenCalledTimes(1);
  await pulsar("Reintentar"); expect(codigos()).toHaveLength(1);
});
it("oculta el código en segundo plano y revalida al volver sin duplicar consultas", async () => {
  await montar();
  const listener = (AppState.addEventListener as jest.Mock).mock.calls[0][1];
  await act(async () => { listener("background"); listener("active"); listener("active"); });
  expect(codigos()).toHaveLength(0);
  expect(mockQR).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(30000); });
  expect(mockQR).toHaveBeenCalledTimes(2);
  expect(codigos()).toHaveLength(1);
  await act(async () => { jest.advanceTimersByTime(30000); });
  expect(mockQR).toHaveBeenCalledTimes(2);
});
it("descarta la respuesta de otra visita al cambiar el id", async () => {
  let resolver!: (value: unknown) => void;
  mockQR.mockReturnValueOnce(new Promise(resolve => { resolver = resolve; }));
  await montar();
  mockId = "124";
  await act(async () => { screen.update(<CodigoQrScreen />); resolver(data); });
  expect(codigos()).toHaveLength(0);
  mockQR.mockResolvedValue({ ...data, visita_id: 124, folio: "KV-000124", qr: "otro-token" });
  await act(async () => { jest.advanceTimersByTime(30000); });
  expect(codigos()[0].props.value).toBe("otro-token");
});

it("muestra el QR guardado con aviso explícito y última comprobación al fallar la red", async () => {
  mockQR.mockRejectedValue(new ErrorConexion());
  mockGuardado.mockResolvedValue({ ...data, ultima_comprobacion: Date.now() });
  await montar();
  expect(mockGuardado).toHaveBeenCalledWith("123");
  expect(codigos()[0].props.value).toBe(data.qr);
  const contenido = JSON.stringify(screen.toJSON());
  expect(contenido).toContain("Sin conexión · QR no verificado");
  expect(contenido).toContain("Última comprobación");
  expect(contenido).not.toContain("✓ Válido");
});

it.each([-1, 0, 1])("no muestra copia antes del inicio; límite %s ms", async delta => {
  jest.setSystemTime(Date.parse(data.vigente_desde) + delta);
  mockQR.mockRejectedValue(new ErrorConexion());
  mockGuardado.mockResolvedValue({ ...data, ultima_comprobacion: Date.now() - 1000 });
  await montar(); expect(codigos()).toHaveLength(delta < 0 ? 0 : 1);
});

it.each([-1, 0, 1])("respeta el fin de la ventana offline; límite %s ms", async delta => {
  jest.setSystemTime(Date.parse(data.vigente_hasta) + delta);
  mockQR.mockRejectedValue(new ErrorConexion());
  mockGuardado.mockResolvedValue({ ...data, ultima_comprobacion: Date.now() - 1000 });
  await montar(); expect(codigos()).toHaveLength(delta <= 0 ? 1 : 0);
});

it("retira la copia offline al vencer sin consultar otra vez", async () => {
  jest.setSystemTime(Date.parse(data.vigente_hasta) - 1);
  mockQR.mockRejectedValue(new ErrorConexion());
  mockGuardado.mockResolvedValue({ ...data, ultima_comprobacion: Date.now() - 1000 });
  await montar(); await act(async () => { jest.advanceTimersByTime(2); });
  expect(codigos()).toHaveLength(0); expect(mockQR).toHaveBeenCalledTimes(1);
});

it.each(["403", "404", "contrato", "AbortError", "401"])("no consulta caché ante %s", async tipo => {
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const error = tipo === "401" ? new SesionExpiradaError() : new Error(tipo);
  if (tipo === "AbortError") error.name = tipo;
  mockQR.mockRejectedValue(error);
  mockGuardado.mockResolvedValue({ ...data, ultima_comprobacion: Date.now() });
  await montar(); expect(mockGuardado).not.toHaveBeenCalled(); expect(codigos()).toHaveLength(0);
});

it("recupera caché tras timeout y conserva el límite de actualización", async () => {
  mockQR.mockImplementation((_id, signal: AbortSignal) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => { const e = new Error("timeout"); e.name = "AbortError"; reject(e); });
  }));
  mockGuardado.mockResolvedValue({ ...data, ultima_comprobacion: Date.now() });
  await montar(); await act(async () => { jest.advanceTimersByTime(15000); });
  expect(codigos()).toHaveLength(1);
  expect(screen.root.findByProps({ accessibilityLabel: "Actualizar estado" }).props.disabled).toBe(true);
});

it("descarta recuperación tardía de caché tras cambiar de sesión", async () => {
  let resolver!: (value: unknown) => void;
  mockQR.mockRejectedValue(new ErrorConexion());
  mockGuardado.mockReturnValue(new Promise(resolve => { resolver = resolve; }));
  await montar();
  (VisitasService.generacionSesionPush as jest.Mock).mockReturnValue(1);
  await act(async () => { resolver({ ...data, ultima_comprobacion: Date.now() }); });
  expect(codigos()).toHaveLength(0);
});

it("sustituye la copia no verificada al actualizar exitosamente", async () => {
  mockQR.mockRejectedValueOnce(new ErrorConexion());
  mockGuardado.mockResolvedValue({ ...data, ultima_comprobacion: Date.now() });
  await montar(); await act(async () => { jest.advanceTimersByTime(30000); });
  await pulsar("Actualizar estado");
  expect(codigos()).toHaveLength(1);
  expect(JSON.stringify(screen.toJSON())).not.toContain("Sin conexión · QR no verificado");
});

it("redirige por 401 aunque la invalidación haya incrementado la generación", async () => {
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  mockQR.mockImplementation(async () => {
    (VisitasService.generacionSesionPush as jest.Mock).mockReturnValue(1);
    throw new SesionExpiradaError();
  });
  await montar(); expect(mockReplace).toHaveBeenCalledWith("/");
  expect(mockGuardado).not.toHaveBeenCalled();
});

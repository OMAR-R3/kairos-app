import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import NavButton from "../../components/NavButton";
import InicioScreen from "../../app/inicio";
import { VisitasService } from "../../services/VisitasService";

const mockPush = jest.fn();
const mockRouter = { push: mockPush, replace: jest.fn() };
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (callback: () => void) => { jest.requireActual<typeof React>("react").useEffect(callback, [callback]); },
}));
jest.mock("../../services/VisitasService", () => ({
  VisitasService: { obtenerQRGuardado: jest.fn(), logout: jest.fn() },
}));
jest.mock("../../hooks/usePermisoNotificaciones", () => ({
  __esModule: true, default: () => ({ mostrarAviso: false, permisoDenegado: false }),
}));
jest.mock("../../components/AvisoNotificaciones", () => () => null);
jest.mock("../../components/BannerPermisoDenegado", () => () => null);

const leer = VisitasService.obtenerQRGuardado as jest.Mock;
let screen: ReactTestRenderer;
const fin = Date.parse("2026-11-07T18:30:00Z");
beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(fin - 1000); jest.clearAllMocks();
  leer.mockReset(); leer.mockResolvedValue(null);
});
afterEach(async () => { if (screen) await act(async () => screen.unmount()); jest.useRealTimers(); });
async function montar() { await act(async () => { screen = create(<InicioScreen />); }); }

it("ofrece acceso directo a la visita guardada sin consultar lista ni detalle", async () => {
  leer.mockResolvedValue({ visita_id: 123, vigente_hasta: new Date(fin).toISOString() });
  await montar();
  const acceso = screen.root.findAllByType(NavButton).find(n => n.props.label === "Ver último QR guardado")!;
  expect(acceso.props.href).toEqual({ pathname: "/codigo-qr", params: { id: "123" } });
});

it("oculta el acceso si no existe una copia de la sesión actual", async () => {
  await montar(); expect(JSON.stringify(screen.toJSON())).not.toContain("Ver último QR guardado");
});

it("retira el acceso al vencer la copia", async () => {
  leer.mockResolvedValueOnce({ visita_id: 123, vigente_hasta: new Date(fin).toISOString() });
  await montar(); expect(JSON.stringify(screen.toJSON())).toContain("Ver último QR guardado");
  await act(async () => { jest.advanceTimersByTime(1001); });
  expect(JSON.stringify(screen.toJSON())).not.toContain("Ver último QR guardado");
});

import { act, create, ReactTestRenderer } from "react-test-renderer";
import MisVisitasScreen from "../../app/mis-visitas";
import { VisitasService } from "../../services/VisitasService";
import type { Visita } from "../../services/VisitasService";

const mockRouter = { push: jest.fn(), replace: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("../../services/NotificacionesService", () => ({
  NotificacionesService: {},
}));

const visita: Visita = {
  id: 1, depto_id: 2, fecha: "2026-11-25", hora_inicio: "09:00:00",
  motivo: "Reunión", estado: "pendiente",
};

afterEach(() => jest.restoreAllMocks());

it("muestra el aviso offline cuando los datos vienen de la caché", async () => {
  jest.spyOn(VisitasService, "obtenerMisVisitas").mockResolvedValue([visita]);
  jest.spyOn(VisitasService, "obtenerDepartamentos").mockResolvedValue([]);
  jest.spyOn(VisitasService, "ultimaConsultaOffline").mockReturnValue(true);

  let pantalla!: ReactTestRenderer;
  await act(async () => { pantalla = create(<MisVisitasScreen />); });

  const renderizado = JSON.stringify(pantalla.toJSON());
  expect(renderizado).toContain("Sin conexión");
  expect(renderizado).toContain("mostrando la última actualización");
  expect(renderizado).toContain("Reunión");

  act(() => pantalla.unmount());
});

it("no muestra el aviso offline cuando los datos vienen del servidor", async () => {
  jest.spyOn(VisitasService, "obtenerMisVisitas").mockResolvedValue([visita]);
  jest.spyOn(VisitasService, "obtenerDepartamentos").mockResolvedValue([]);
  jest.spyOn(VisitasService, "ultimaConsultaOffline").mockReturnValue(false);

  let pantalla!: ReactTestRenderer;
  await act(async () => { pantalla = create(<MisVisitasScreen />); });

  const renderizado = JSON.stringify(pantalla.toJSON());
  expect(renderizado).not.toContain("Sin conexión");
  expect(renderizado).toContain("Reunión");

  act(() => pantalla.unmount());
});

it("sin conexión y sin lista guardada muestra el error amigable, no el aviso", async () => {
  jest.spyOn(VisitasService, "obtenerMisVisitas").mockRejectedValue(
    new (jest.requireActual<typeof import("../../services/VisitasService")>("../../services/VisitasService")).ErrorConexion(),
  );
  jest.spyOn(VisitasService, "obtenerDepartamentos").mockResolvedValue([]);

  let pantalla!: ReactTestRenderer;
  await act(async () => { pantalla = create(<MisVisitasScreen />); });

  const renderizado = JSON.stringify(pantalla.toJSON());
  expect(renderizado).toContain("No se pudo conectar");
  expect(renderizado).not.toContain("mostrando la última actualización");
  expect(renderizado).toContain("Reintentar");

  act(() => pantalla.unmount());
});

import { act, create, ReactTestRenderer } from "react-test-renderer";
import MisVisitasScreen from "../../app/mis-visitas";
import { ErrorConexion, Visita, VisitasService } from "../../services/VisitasService";

const mockRouter = { push: jest.fn(), replace: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("../../services/NotificacionesService", () => ({ NotificacionesService: {} }));

const visita: Visita = {
  id: 1, depto_id: 2, fecha: "2026-11-25", hora_inicio: "09:00:00",
  motivo: "Reunión", estado: "pendiente",
  departamento: { id: 2, nombre: "Vinculación" },
};

let pantalla: ReactTestRenderer;

afterEach(() => {
  if (pantalla) act(() => pantalla.unmount());
  jest.restoreAllMocks();
});

function contenido() {
  return JSON.stringify(pantalla.toJSON());
}

it("muestra el aviso sin conexión cuando las visitas se cargan del caché", async () => {
  jest.spyOn(VisitasService, "obtenerMisVisitas").mockResolvedValue([visita]);
  jest.spyOn(VisitasService, "obtenerDepartamentos").mockRejectedValue(new ErrorConexion());

  await act(async () => { pantalla = create(<MisVisitasScreen />); });

  const texto = contenido();
  expect(texto).toContain("Sin conexión");
  expect(texto).toContain("Mostrando la última actualización");
  expect(texto).toContain("Reintentar");
  expect(texto).toContain("Reunión");
});

it("oculta el aviso cuando hay conexión", async () => {
  jest.spyOn(VisitasService, "obtenerMisVisitas").mockResolvedValue([visita]);
  jest.spyOn(VisitasService, "obtenerDepartamentos").mockResolvedValue([{ id: 2, nombre: "Vinculación" }]);

  await act(async () => { pantalla = create(<MisVisitasScreen />); });

  const texto = contenido();
  expect(texto).not.toContain("Sin conexión");
  expect(texto).toContain("Reunión");
});

it("el aviso desaparece al reintentar con conexión restaurada", async () => {
  jest.spyOn(VisitasService, "obtenerMisVisitas").mockResolvedValue([visita]);
  const mockDeptos = jest.spyOn(VisitasService, "obtenerDepartamentos")
    .mockRejectedValueOnce(new ErrorConexion());

  await act(async () => { pantalla = create(<MisVisitasScreen />); });
  expect(contenido()).toContain("Sin conexión");

  mockDeptos.mockResolvedValueOnce([{ id: 2, nombre: "Vinculación" }]);
  const botonReintentar = pantalla.root.findAll(
    ({ props }) => props.accessibilityRole === "button" && props.onPress,
  ).find(node => JSON.stringify(node.toJSON()).includes("Reintentar"));

  await act(async () => { botonReintentar!.props.onPress(); });
  expect(contenido()).not.toContain("Sin conexión");
  expect(contenido()).toContain("Reunión");
});

it("no muestra el aviso cuando no hay visitas ni conexión (pantalla de error)", async () => {
  jest.spyOn(VisitasService, "obtenerMisVisitas").mockRejectedValue(new ErrorConexion());
  jest.spyOn(VisitasService, "obtenerDepartamentos").mockRejectedValue(new ErrorConexion());

  await act(async () => { pantalla = create(<MisVisitasScreen />); });

  const texto = contenido();
  expect(texto).not.toContain("Mostrando la última actualización");
  expect(texto).toContain("No se pudo conectar");
});

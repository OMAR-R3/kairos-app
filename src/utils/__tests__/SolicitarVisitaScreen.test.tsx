import { act, create, ReactTestRenderer } from "react-test-renderer";
import SolicitarVisitaScreen from "../../app/solicitar-visita";
import { VisitasService } from "../../services/VisitasService";

jest.mock("expo-router", () => ({ useRouter: () => ({}) }));
jest.mock("../../services/VisitasService", () => ({
  VisitasService: { obtenerDepartamentos: jest.fn() },
}));

const obtenerDepartamentos = jest.mocked(VisitasService.obtenerDepartamentos);
let pantalla: ReactTestRenderer;

afterEach(() => {
  act(() => pantalla.unmount());
  obtenerDepartamentos.mockReset();
});

function contenido() {
  return JSON.stringify(pantalla.toJSON());
}

it("muestra que los departamentos están cargando antes de indicar que la lista está vacía", async () => {
  let resolver!: (departamentos: []) => void;
  obtenerDepartamentos.mockReturnValueOnce(new Promise(resolve => { resolver = resolve; }));

  await act(async () => { pantalla = create(<SolicitarVisitaScreen />); });
  expect(contenido()).toContain("Cargando departamentos…");
  expect(contenido()).not.toContain("No hay departamentos disponibles.");

  await act(async () => resolver([]));
  expect(contenido()).toContain("No hay departamentos disponibles.");
  expect(contenido()).not.toContain("Cargando departamentos…");
});

it("muestra la causa de un fallo al cargar departamentos", async () => {
  const mensaje = "No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.";
  obtenerDepartamentos.mockRejectedValueOnce(new Error(mensaje));

  await act(async () => { pantalla = create(<SolicitarVisitaScreen />); });
  expect(contenido()).toContain(mensaje);
  expect(contenido()).not.toContain("No hay departamentos disponibles.");
  expect(contenido()).not.toContain("Cargando departamentos…");
});

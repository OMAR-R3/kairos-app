import { act, create, ReactTestRenderer } from "react-test-renderer";
import MisVisitasScreen from "../../app/mis-visitas";
import { ErrorConexion, VisitasService } from "../../services/VisitasService";

const mockRouter = { push: jest.fn(), replace: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("../../services/NotificacionesService", () => ({ NotificacionesService: {} }));

it("muestra las visitas disponibles aunque el catálogo de departamentos no tenga conexión", async () => {
  jest.spyOn(VisitasService, "obtenerMisVisitas").mockResolvedValue([{
    id: 123, depto_id: 2, fecha: "2026-11-25", hora_inicio: "09:00:00",
    motivo: "Reunión guardada", estado: "pendiente",
  }]);
  jest.spyOn(VisitasService, "obtenerDepartamentos").mockRejectedValue(new ErrorConexion());

  let pantalla!: ReactTestRenderer;
  try {
    await act(async () => { pantalla = create(<MisVisitasScreen />); });
    const renderizado = JSON.stringify(pantalla.toJSON());
    expect(renderizado).toContain("Reunión guardada");
    expect(renderizado).not.toContain("No se pudo conectar");
  } finally {
    if (pantalla) act(() => pantalla.unmount());
    jest.restoreAllMocks();
  }
});

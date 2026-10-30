// Pruebas del manejador del toque de la notificación (hook). Se ejecuta el hook
// como función normal: useEffect corre al instante y useRef conserva su valor,
// así no hace falta una librería extra de renderizado.

import { Alert } from "react-native";

const mockRouter = { push: jest.fn(), replace: jest.fn() };
const refs: { current: unknown }[] = [];
let mockRespuesta: unknown = null;

jest.mock("react", () => {
  const real = jest.requireActual("react");
  return {
    ...real,
    useEffect: (fn: () => void) => fn(),
    useRef: (valor: unknown) => {
      if (!refs[0]) refs[0] = { current: valor };
      return refs[0];
    },
  };
});
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("expo-notifications", () => ({
  __esModule: true,
  setNotificationHandler: jest.fn(),
  useLastNotificationResponse: () => mockRespuesta,
}));
const mockRestaurarSesion = jest.fn();
jest.mock("../../services/VisitasService", () => ({
  VisitasService: { restaurarSesion: (...a: unknown[]) => mockRestaurarSesion(...a) },
}));

import useNotificationNavigation from "@/hooks/useNotificationNavigation";

const toque = (id: string, data: Record<string, unknown> | undefined) => ({
  notification: { request: { identifier: id, content: { data } } },
});
const esperar = () => new Promise((r) => setImmediate(r));

describe("useNotificationNavigation: toque de la notificación", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    refs.length = 0;
    mockRespuesta = null;
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  it("al tocarla con sesión activa abre el detalle con el id correcto", async () => {
    mockRestaurarSesion.mockResolvedValue(true);
    mockRespuesta = toque("n1", { visita_id: 42 });

    useNotificationNavigation();
    await esperar();

    expect(mockRouter.push).toHaveBeenCalledWith("/detalle-visita/42");
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("acepta el id como texto (así llega desde la API de Expo)", async () => {
    mockRestaurarSesion.mockResolvedValue(true);
    mockRespuesta = toque("n2", { visita_id: "7" });

    useNotificationNavigation();
    await esperar();

    expect(mockRouter.push).toHaveBeenCalledWith("/detalle-visita/7");
  });

  it("con la sesión vencida avisa y regresa al login sin abrir el detalle", async () => {
    mockRestaurarSesion.mockResolvedValue(false);
    mockRespuesta = toque("n3", { visita_id: 42 });

    useNotificationNavigation();
    await esperar();

    expect(Alert.alert).toHaveBeenCalledWith(
      "Sesión expirada",
      "Tu sesión expiró, inicia sesión de nuevo"
    );
    expect(mockRouter.replace).toHaveBeenCalledWith("/");
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it.each([
    ["sin data", undefined],
    ["sin visita_id", { otro: "campo" }],
    ["id vacío", { visita_id: "" }],
    ["id no numérico", { visita_id: "abc" }],
    ["id cero", { visita_id: 0 }],
    ["id negativo", { visita_id: "-5" }],
  ])("ignora la notificación %s", async (_nombre, data) => {
    mockRestaurarSesion.mockResolvedValue(true);
    mockRespuesta = toque("n4", data as any);

    useNotificationNavigation();
    await esperar();

    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("no hace nada cuando todavía no se tocó ninguna notificación", async () => {
    mockRespuesta = null;

    useNotificationNavigation();
    await esperar();

    expect(mockRestaurarSesion).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("la misma notificación no navega dos veces", async () => {
    mockRestaurarSesion.mockResolvedValue(true);
    mockRespuesta = toque("n5", { visita_id: 9 });

    useNotificationNavigation();
    useNotificationNavigation(); // el efecto se vuelve a ejecutar con la misma respuesta
    await esperar();

    expect(mockRouter.push).toHaveBeenCalledTimes(1);
  });
});

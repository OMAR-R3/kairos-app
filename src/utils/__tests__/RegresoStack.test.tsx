import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import RootLayout from "../../app/_layout";

let mockPantalla: string;
let mockId: unknown;
const mockRouter = {
  canGoBack: jest.fn(),
  back: jest.fn(),
  dismissTo: jest.fn(),
  replace: jest.fn(),
};

jest.mock("../../hooks/useNotificationNavigation", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
jest.mock("expo-router", () => {
  const react = jest.requireActual<typeof React>("react");
  type MockOpciones = {
    headerShown?: boolean;
    header?: (props: { route: { name: string; params: { id: unknown } } }) => React.ReactNode;
  };

  function Stack({ children, screenOptions }: { children: React.ReactNode; screenOptions: MockOpciones }) {
    const pantalla = react.Children.toArray(children).find(
      (hijo): hijo is React.ReactElement<{ name: string; options?: MockOpciones }> =>
        react.isValidElement<{ name: string }>(hijo) && hijo.props.name === mockPantalla,
    );
    const opciones = { ...screenOptions, ...pantalla?.props.options };
    return opciones.headerShown
      ? opciones.header?.({ route: { name: mockPantalla, params: { id: mockId } } })
      : null;
  }
  Stack.Screen = function Screen() { return null; };

  return { Stack, useRouter: () => mockRouter };
});

let layout: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.canGoBack.mockReturnValue(true);
});
afterEach(() => {
  act(() => layout.unmount());
});

function montar(pantalla: string, id?: unknown) {
  mockPantalla = pantalla;
  mockId = id;
  act(() => { layout = create(<RootLayout />); });
  return layout.root.findAll(
    ({ props }) => props.accessibilityLabel === "Volver" && typeof props.onPress === "function",
  );
}

it.each(["solicitar-visita", "detalle-visita/[id]", "codigo-qr", "mis-visitas", "crear-cuenta"])(
  "muestra un botón accesible en %s y vuelve a la pantalla anterior",
  pantalla => {
    const botones = montar(pantalla, "123");
    expect(botones).toHaveLength(1);
    expect(botones[0].props).toMatchObject({ accessibilityRole: "button", accessibilityLabel: "Volver" });
    act(() => botones[0].props.onPress());
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  },
);

it.each(["index", "inicio", "consultar-historial"])("oculta el botón del Stack en %s", pantalla => {
  expect(montar(pantalla)).toHaveLength(0);
});

it.each([
  ["solicitar-visita", "/inicio"],
  ["mis-visitas", "/inicio"],
  ["detalle-visita/[id]", "/mis-visitas"],
  ["codigo-qr", "/mis-visitas"],
  ["crear-cuenta", "/"],
])("usa un destino de respaldo desde %s sin historial", (pantalla, destino) => {
  mockRouter.canGoBack.mockReturnValue(false);
  const [boton] = montar(pantalla, ["123", "124"]);
  act(() => boton.props.onPress());
  expect(mockRouter.replace).toHaveBeenCalledWith(destino);
  expect(mockRouter.back).not.toHaveBeenCalled();
});

it("vuelve al detalle de la misma visita desde un QR sin historial", () => {
  mockRouter.canGoBack.mockReturnValue(false);
  const [boton] = montar("codigo-qr", "123");
  act(() => boton.props.onPress());
  expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: "/detalle-visita/[id]", params: { id: "123" } });
  expect(mockRouter.back).not.toHaveBeenCalled();
});

it.each([true, false])("vuelve a Inicio desde confirmación con canGoBack=%s", hayHistorial => {
  mockRouter.canGoBack.mockReturnValue(hayHistorial);
  const [boton] = montar("confirmacion");
  act(() => boton.props.onPress());
  expect(mockRouter.dismissTo).toHaveBeenCalledWith("/inicio");
  expect(mockRouter.back).not.toHaveBeenCalled();
});

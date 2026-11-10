import React from "react";
import { ActivityIndicator, Alert, AppState } from "react-native";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import CodigoQrScreen from "../../app/codigo-qr";
import {
  SesionExpiradaError,
  VisitaNoEncontradaError,
  VisitasService,
} from "../../services/VisitasService";
jest.setTimeout(30000);

// Pruebas de la lógica de la pantalla del QR (HU-06): estados, errores y bloqueo de consultas.
// Complementan CodigoQrScreen.test.tsx (segundo plano, vigencia y cambio de id).
const mockReplace = jest.fn();
let mockId: string | string[] | undefined = "123";
const mockRouter = { replace: mockReplace };
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ id: mockId }),
  useFocusEffect: (callback: () => void) => {
    jest.requireActual<typeof React>("react").useEffect(callback, [callback]);
  },
}));
jest.mock("react-native-qrcode-svg", () => "QRCode");
jest.mock("../../services/VisitasService", () => {
  const actual = jest.requireActual("../../services/VisitasService");
  return { ...actual, VisitasService: { obtenerQR: jest.fn() } };
});

const mockQR = VisitasService.obtenerQR as jest.Mock;
const data = {
  visita_id: 123,
  folio: "KV-000123",
  qr: "token-real",
  estado_qr: "valido",
  vigente_desde: "2026-11-07T17:30:00.000Z",
  vigente_hasta: "2026-11-07T18:30:00.000Z",
};
let screen: ReactTestRenderer;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-11-07T18:00:00Z"));
  mockId = "123";
  mockQR.mockReset();
  mockReplace.mockReset();
  mockQR.mockResolvedValue(data);
  jest
    .spyOn(AppState, "addEventListener")
    .mockReturnValue({ remove: jest.fn() });
});
afterEach(async () => {
  if (screen) await act(async () => screen.unmount());
  jest.restoreAllMocks();
  jest.useRealTimers();
});

async function montar() {
  await act(async () => {
    screen = create(<CodigoQrScreen />);
  });
}
// Texto visible: une los fragmentos de cada <Text> (por ejemplo "Folio " + "KV-000123").
const texto = () =>
  screen.root
    .findAll((n) => (n.type as unknown) === "Text")
    .map((n) =>
      n.children
        .flat()
        .filter((c) => typeof c === "string")
        .join(""),
    )
    .join("\n");
const codigos = () =>
  screen.root.findAll((node) => node.type === ("QRCode" as unknown));
const boton = (label: string) =>
  screen.root.findByProps({ accessibilityLabel: label });
async function pulsar(label: string) {
  await act(async () => {
    boton(label).props.onPress();
  });
}

describe("estados del código", () => {
  it("válido: muestra el código, el folio, la vigencia y el mensaje de uso", async () => {
    await montar();
    expect(codigos()).toHaveLength(1);
    expect(codigos()[0].props.value).toBe("token-real");
    expect(texto()).toContain("Válido");
    expect(texto()).toContain("Muestra este código en la caseta de vigilancia");
    expect(texto()).toContain("Folio KV-000123");
    expect(texto()).toContain("hora de Ciudad de México");
    expect(texto()).not.toContain("Código expirado");
  });

  it("expirado: muestra el aviso en lugar del código", async () => {
    mockQR.mockResolvedValue({ ...data, estado_qr: "expirado", qr: null });
    await montar();
    expect(codigos()).toHaveLength(0);
    expect(texto()).toContain("Código expirado");
    expect(texto()).toContain(
      "Este código ya no es válido. Solicita una nueva visita.",
    );
  });

  it("usado: muestra el aviso en lugar del código", async () => {
    mockQR.mockResolvedValue({ ...data, estado_qr: "usado", qr: null });
    await montar();
    expect(codigos()).toHaveLength(0);
    expect(texto()).toContain("Código utilizado");
    expect(texto()).toContain("Este código ya fue utilizado para ingresar.");
  });

  it("muestra el indicador de carga mientras llega la respuesta", async () => {
    mockQR.mockReturnValue(new Promise(() => {}));
    await montar();
    expect(screen.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(codigos()).toHaveLength(0);
  });
});

describe("errores", () => {
  it("visita no encontrada: muestra el mensaje y permite reintentar", async () => {
    mockQR.mockRejectedValue(new VisitaNoEncontradaError());
    await montar();
    expect(texto()).toContain("No se encontró la visita solicitada.");
    expect(codigos()).toHaveLength(0);
    expect(boton("Reintentar")).toBeTruthy();
  });

  it("sesión expirada: avisa y regresa al inicio de sesión sin mostrar código", async () => {
    const alerta = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockQR.mockRejectedValue(new SesionExpiradaError());
    await montar();
    expect(alerta).toHaveBeenCalledWith(
      "Sesión expirada",
      "Tu sesión expiró, inicia sesión de nuevo",
    );
    expect(mockReplace).toHaveBeenCalledWith("/");
    expect(codigos()).toHaveLength(0);
  });

  it("error de conexión: muestra el mensaje amigable sin cerrar la sesión", async () => {
    mockQR.mockRejectedValue(
      new Error(
        "No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.",
      ),
    );
    await montar();
    expect(texto()).toContain(
      "No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.",
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("muestra el mensaje genérico cuando el error no trae texto", async () => {
    mockQR.mockRejectedValue("falla");
    await montar();
    expect(texto()).toContain("No se pudo obtener el código QR.");
  });

  it("respuesta inválida: muestra el error y no dibuja ningún código", async () => {
    mockQR.mockRejectedValue(
      new Error("La respuesta del código QR no es válida. Inténtalo de nuevo."),
    );
    await montar();
    expect(texto()).toContain("La respuesta del código QR no es válida");
    expect(codigos()).toHaveLength(0);
  });

  it("se recupera al reintentar después de un error", async () => {
    jest.setSystemTime(new Date("2026-11-07T18:00:00Z"));
    mockQR.mockRejectedValueOnce(new VisitaNoEncontradaError());
    await montar();
    expect(codigos()).toHaveLength(0);
    await act(async () => {
      jest.advanceTimersByTime(30000);
    });
    await pulsar("Reintentar");
    expect(codigos()).toHaveLength(1);
    expect(texto()).not.toContain("No se encontró la visita solicitada.");
  });
});

describe("identificador de la visita", () => {
  it.each([undefined, "abc", "0", "12abc"])(
    "id %s: muestra el error y no consulta el servicio",
    async (valor) => {
      mockId = valor;
      await montar();
      expect(mockQR).not.toHaveBeenCalled();
      expect(texto()).toContain("El identificador de la visita no es válido.");
      expect(codigos()).toHaveLength(0);
    },
  );

  it("con id inválido, Volver regresa a Mis visitas y no hay botón de actualizar", async () => {
    mockId = "abc";
    await montar();
    expect(
      screen.root.findAllByProps({ accessibilityLabel: "Actualizar estado" }),
    ).toHaveLength(0);
    await pulsar("Volver");
    expect(mockReplace).toHaveBeenCalledWith("/mis-visitas");
  });
});

describe("consultas al servicio", () => {
  it("consulta una sola vez al abrir la pantalla con el id de la visita", async () => {
    await montar();
    expect(mockQR).toHaveBeenCalledTimes(1);
    expect(mockQR.mock.calls[0][0]).toBe("123");
  });

  it("bloquea la actualización 30 segundos y luego la habilita", async () => {
    await montar();
    expect(boton("Actualizar estado").props.disabled).toBe(true);
    expect(texto()).toContain("Podrás actualizar nuevamente en unos segundos.");
    await act(async () => {
      jest.advanceTimersByTime(30000);
    });
    expect(boton("Actualizar estado").props.disabled).toBe(false);
    expect(texto()).not.toContain("Podrás actualizar nuevamente");
  });

  it("actualizar vuelve a consultar el estado del código", async () => {
    await montar();
    await act(async () => {
      jest.advanceTimersByTime(30000);
    });
    mockQR.mockResolvedValue({ ...data, estado_qr: "usado", qr: null });
    await pulsar("Actualizar estado");
    expect(mockQR).toHaveBeenCalledTimes(2);
    expect(texto()).toContain("Código utilizado");
    expect(codigos()).toHaveLength(0);
  });

  it("cancela la consulta si el servidor tarda más de 15 segundos", async () => {
    mockQR.mockReturnValue(new Promise(() => {}));
    await montar();
    const senal: AbortSignal = mockQR.mock.calls[0][1];
    expect(senal.aborted).toBe(false);
    await act(async () => {
      jest.advanceTimersByTime(15000);
    });
    expect(senal.aborted).toBe(true);
  });

  it("cancela la consulta pendiente al salir de la pantalla", async () => {
    mockQR.mockReturnValue(new Promise(() => {}));
    await montar();
    const senal: AbortSignal = mockQR.mock.calls[0][1];
    await act(async () => {
      screen.unmount();
    });
    expect(senal.aborted).toBe(true);
  });

  it("no consulta de nuevo por sondeo mientras el código es válido", async () => {
    await montar();
    await act(async () => {
      jest.advanceTimersByTime(20000);
    });
    expect(mockQR).toHaveBeenCalledTimes(1);
  });
});

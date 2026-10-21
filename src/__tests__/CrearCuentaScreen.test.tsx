import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import CrearCuentaScreen from "../app/crear-cuenta";
import { VisitasService } from "../services/VisitasService";

// La primera carga de la pantalla puede tardar más de 5 s en una computadora lenta.
jest.setTimeout(20000);

// El router y el servicio se simulan: así la prueba revisa solo la pantalla.
const mockRouter = { replace: jest.fn(), push: jest.fn() };

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
}));

jest.mock("../services/VisitasService", () => ({
  VisitasService: { registrarVisitante: jest.fn() },
}));

const registrarVisitante = VisitasService.registrarVisitante as jest.Mock;

// Orden de los campos del formulario, de arriba hacia abajo.
const VALIDOS = [
  "Ana", // nombre
  "Lopez", // apellido paterno
  "", // apellido materno (opcional)
  "ana@example.com", // correo
  "4421234567", // teléfono
  "contrasena123", // contraseña
  "contrasena123", // confirmar contraseña
];

async function llenar(valores: string[]) {
  const campos = screen.getAllByDisplayValue("");
  for (let i = 0; i < valores.length; i++) {
    if (valores[i]) await fireEvent.changeText(campos[i], valores[i]);
  }
}

// "Crear cuenta" aparece como título y como botón; el botón es el último.
async function presionarCrearCuenta() {
  const textos = screen.getAllByText("Crear cuenta");
  await fireEvent.press(textos[textos.length - 1]);
}

describe("Pantalla de Crear cuenta", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  it("muestra los campos del formulario y los botones", async () => {
    await render(<CrearCuentaScreen />);

    expect(screen.getByText("Nombre(s)")).toBeOnTheScreen();
    expect(screen.getByText("Apellido paterno")).toBeOnTheScreen();
    expect(screen.getByText("Apellido materno (opcional)")).toBeOnTheScreen();
    expect(screen.getByText("Correo")).toBeOnTheScreen();
    expect(screen.getByText("Telefono (10 digitos)")).toBeOnTheScreen();
    expect(screen.getByText("Contrasena")).toBeOnTheScreen();
    expect(screen.getByText("Confirmar contrasena")).toBeOnTheScreen();
    expect(screen.getByText("Ya tengo cuenta")).toBeOnTheScreen();
  });

  it("muestra los errores de los campos obligatorios al enviar vacío", async () => {
    await render(<CrearCuentaScreen />);
    await presionarCrearCuenta();

    expect(screen.getByText("Escribe tu nombre")).toBeOnTheScreen();
    expect(screen.getByText("Escribe tu apellido paterno")).toBeOnTheScreen();
    expect(screen.getByText("Escribe tu correo")).toBeOnTheScreen();
    expect(screen.getByText("Escribe tu telefono")).toBeOnTheScreen();
    expect(screen.getByText("Escribe una contrasena")).toBeOnTheScreen();
    expect(screen.getByText("Confirma tu contrasena")).toBeOnTheScreen();
    expect(registrarVisitante).not.toHaveBeenCalled();
  });

  it("rechaza un teléfono que no tiene 10 dígitos", async () => {
    await render(<CrearCuentaScreen />);
    await llenar([...VALIDOS.slice(0, 4), "44212", ...VALIDOS.slice(5)]);
    await presionarCrearCuenta();

    expect(screen.getByText("Debe tener 10 digitos")).toBeOnTheScreen();
    expect(registrarVisitante).not.toHaveBeenCalled();
  });

  it("rechaza contraseñas que no coinciden", async () => {
    await render(<CrearCuentaScreen />);
    await llenar([...VALIDOS.slice(0, 6), "otra12345"]);
    await presionarCrearCuenta();

    expect(screen.getByText("Las contrasenas no coinciden")).toBeOnTheScreen();
    expect(registrarVisitante).not.toHaveBeenCalled();
  });

  it("crea la cuenta con datos correctos y regresa al login", async () => {
    registrarVisitante.mockResolvedValue(undefined);
    await render(<CrearCuentaScreen />);
    await llenar(VALIDOS);
    await presionarCrearCuenta();

    await waitFor(() =>
      expect(registrarVisitante).toHaveBeenCalledWith({
        nombre: "Ana",
        apellido_paterno: "Lopez",
        apellido_materno: null,
        correo: "ana@example.com",
        telefono: "4421234567",
        password: "contrasena123",
      })
    );
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        "Cuenta creada",
        "Ya puedes iniciar sesion con tu correo.",
        expect.any(Array)
      )
    );

    // Al aceptar el aviso, la app regresa a la pantalla de login.
    const botones = (Alert.alert as jest.Mock).mock.calls[0][2];
    botones[0].onPress();
    expect(mockRouter.replace).toHaveBeenCalledWith("/");
  });

  it("muestra un mensaje de error cuando el servicio rechaza el registro", async () => {
    registrarVisitante.mockRejectedValue(new Error("El correo ya esta registrado"));
    await render(<CrearCuentaScreen />);
    await llenar(VALIDOS);
    await presionarCrearCuenta();

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Error", "El correo ya esta registrado")
    );
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("el botón Ya tengo cuenta lleva al login", async () => {
    await render(<CrearCuentaScreen />);
    await fireEvent.press(screen.getByText("Ya tengo cuenta"));

    expect(mockRouter.push).toHaveBeenCalledWith("/");
  });
});

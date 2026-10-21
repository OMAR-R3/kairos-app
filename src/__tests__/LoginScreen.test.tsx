import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import LoginScreen from "../app/index";
import { VisitasService } from "../services/VisitasService";

// La primera carga de la pantalla puede tardar más de 5 s en una computadora lenta.
jest.setTimeout(20000);

// El router y el servicio se simulan: así la prueba revisa solo la pantalla.
const mockRouter = { replace: jest.fn(), push: jest.fn() };

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
}));

jest.mock("../services/VisitasService", () => ({
  VisitasService: { restaurarSesion: jest.fn(), login: jest.fn() },
}));

const restaurarSesion = VisitasService.restaurarSesion as jest.Mock;
const login = VisitasService.login as jest.Mock;

// Escribe en los dos campos del formulario (correo y contraseña).
async function escribir(correo: string, password: string) {
  const [campoCorreo, campoPassword] = screen.getAllByDisplayValue("");
  if (correo) await fireEvent.changeText(campoCorreo, correo);
  if (password) await fireEvent.changeText(campoPassword, password);
}

describe("Pantalla de Login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    restaurarSesion.mockResolvedValue(false);
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  it("muestra el título, los campos y los botones", async () => {
    await render(<LoginScreen />);

    expect(await screen.findByText("Iniciar sesion")).toBeOnTheScreen();
    expect(screen.getByText("Kairos Visitas")).toBeOnTheScreen();
    expect(screen.getByText("Correo")).toBeOnTheScreen();
    expect(screen.getByText("Contrasena")).toBeOnTheScreen();
    expect(screen.getByText("Crear cuenta")).toBeOnTheScreen();
  });

  it("muestra los errores de validación al enviar el formulario vacío", async () => {
    await render(<LoginScreen />);
    await fireEvent.press(await screen.findByText("Iniciar sesion"));

    expect(screen.getByText("El correo es obligatorio.")).toBeOnTheScreen();
    expect(screen.getByText("La contraseña es obligatoria.")).toBeOnTheScreen();
    expect(login).not.toHaveBeenCalled();
  });

  it("muestra error cuando el correo no tiene formato válido", async () => {
    await render(<LoginScreen />);
    await screen.findByText("Iniciar sesion");

    await escribir("correo-invalido", "contrasena123");
    await fireEvent.press(screen.getByText("Iniciar sesion"));

    expect(
      screen.getByText("El correo no tiene un formato válido.")
    ).toBeOnTheScreen();
    expect(login).not.toHaveBeenCalled();
  });

  it("inicia sesión con datos correctos y va a Inicio", async () => {
    login.mockResolvedValue(undefined);
    await render(<LoginScreen />);
    await screen.findByText("Iniciar sesion");

    await escribir("  Visitante@Example.com ", "contrasena123");
    await fireEvent.press(screen.getByText("Iniciar sesion"));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({
        correo: "visitante@example.com",
        password: "contrasena123",
      })
    );
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/inicio"));
  });

  it("muestra un mensaje de error cuando las credenciales son incorrectas", async () => {
    login.mockRejectedValue(new Error("Credenciales incorrectas"));
    await render(<LoginScreen />);
    await screen.findByText("Iniciar sesion");

    await escribir("visitante@example.com", "contrasena123");
    await fireEvent.press(screen.getByText("Iniciar sesion"));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Error", "Credenciales incorrectas")
    );
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("entra directo a Inicio cuando ya hay una sesión vigente", async () => {
    restaurarSesion.mockResolvedValue(true);
    await render(<LoginScreen />);

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/inicio"));
    expect(screen.queryByText("Iniciar sesion")).toBeNull();
  });

  it("el botón Crear cuenta lleva a la pantalla de registro", async () => {
    await render(<LoginScreen />);
    await fireEvent.press(await screen.findByText("Crear cuenta"));

    expect(mockRouter.push).toHaveBeenCalledWith("/crear-cuenta");
  });
});

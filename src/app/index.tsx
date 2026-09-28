import Screen from "../components/Screen";
import NavButton from "../components/NavButton";

// Pantalla 1: Login (HU-01)
// TODO Sprint 2: reemplazar el boton por el formulario real
// (correo/contrasena) conectado a VisitasService.login()
export default function LoginScreen() {
  return (
    <Screen
      title="Kairos Visitas"
      subtitle="Inicia sesion con tu cuenta del Extranet de Kairos"
    >
      <NavButton label="Iniciar sesion (placeholder)" href="/inicio" />
    </Screen>
  );
}

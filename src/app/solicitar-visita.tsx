import Screen from "../components/Screen";
import NavButton from "../components/NavButton";

// Pantalla 3: Solicitar visita (HU-02)
// TODO Sprint 3: reemplazar por el formulario real (persona a
// visitar, fecha, hora, motivo) conectado a
// VisitasService.solicitarVisita()
export default function SolicitarVisitaScreen() {
  return (
    <Screen title="Nueva visita" subtitle="Completa los datos de tu visita">
      <NavButton label="Enviar solicitud (placeholder)" href="/confirmacion" />
    </Screen>
  );
}

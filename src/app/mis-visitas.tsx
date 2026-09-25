import Screen from "../components/Screen";
import NavButton from "../components/NavButton";

// Pantalla 5: Mis visitas (HU-03)
// TODO Sprint 4: reemplazar por la lista real obtenida de
// VisitasService.obtenerHistorial()
export default function MisVisitasScreen() {
  return (
    <Screen
      title="Mis visitas"
      subtitle="Historial y estado de tus solicitudes (placeholder)"
    >
      <NavButton label="Ver detalle (placeholder)" href="/detalle-visita/1" />
    </Screen>
  );
}

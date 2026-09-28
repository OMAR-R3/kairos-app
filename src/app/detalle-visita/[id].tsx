import { useLocalSearchParams } from "expo-router";
import Screen from "../../components/Screen";
import NavButton from "../../components/NavButton";

// Pantalla 6: Detalle de visita (HU-04)
// Ruta dinamica: /detalle-visita/<id> — el id llega por parametro.
// TODO Sprint 5: reemplazar por los datos reales de
// VisitasService.obtenerDetalleVisita(id)
export default function DetalleVisitaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen
      title="Detalle de visita"
      subtitle={`Visita #${id} (placeholder, estado: Aprobada)`}
    >
      <NavButton label="Ver codigo QR" href="/codigo-qr" />
    </Screen>
  );
}

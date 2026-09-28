import Screen from "../components/Screen";
import NavButton from "../components/NavButton";

// Pantalla 4: Confirmacion. Muestra el folio tras enviar la solicitud.
export default function ConfirmacionScreen() {
  return (
    <Screen title="Solicitud enviada" subtitle="Folio KV-000123 (placeholder)">
      <NavButton label="Ver mis visitas" href="/mis-visitas" />
    </Screen>
  );
}

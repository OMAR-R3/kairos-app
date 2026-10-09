import { useLocalSearchParams } from "expo-router";
import Screen from "../components/Screen";
import NavButton from "../components/NavButton";

// Pantalla 4: Confirmacion. Muestra el folio tras enviar la solicitud.
export default function ConfirmacionScreen() {
  const { folio } = useLocalSearchParams<{ folio: string }>();

  return (
    <Screen
      title="Solicitud enviada"
      subtitle={`Folio ${folio ?? "---"}`}
    >
      <NavButton label="Ver mis visitas" href="/mis-visitas" />
      <NavButton label="Volver al inicio" href="/inicio" dark={false} />
    </Screen>
  );
}

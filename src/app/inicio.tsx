import Screen from "../components/Screen";
import NavButton from "../components/NavButton";

// Pantalla 2: Inicio. Punto de entrada a las dos acciones principales.
export default function InicioScreen() {
  return (
    <Screen title="Hola, visitante" subtitle="Que deseas hacer hoy?">
      <NavButton label="Solicitar visita" href="/solicitar-visita" />
      <NavButton label="Mis visitas" href="/mis-visitas" dark={false} />
    </Screen>
  );
}

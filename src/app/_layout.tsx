import { Stack } from "expo-router";

// Navegador raiz de la app. Cada pantalla de Figma corresponde a una
// ruta aqui. Sin tabs porque el recorrido es lineal (ver prototipo
// de Figma: Login -> Inicio -> Solicitar visita -> ... -> QR).
export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="inicio" />
      <Stack.Screen name="solicitar-visita" />
      <Stack.Screen name="confirmacion" />
      <Stack.Screen name="mis-visitas" />
      <Stack.Screen name="detalle-visita/[id]" />
      <Stack.Screen name="codigo-qr" />
    </Stack>
  );
}

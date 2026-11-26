import { Stack, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import useNotificationNavigation from "../hooks/useNotificationNavigation";
import { esIdVisitaValido } from "../services/VisitasService";

const mostrarRegreso = { headerShown: true };

function EncabezadoRegreso({ pantalla, id }: { pantalla: string; id?: unknown }) {
  const router = useRouter();

  const regresar = () => {
    if (pantalla === "confirmacion") {
      router.dismissTo("/inicio");
    } else if (router.canGoBack()) {
      router.back();
    } else if (pantalla === "codigo-qr" && esIdVisitaValido(id)) {
      router.replace({ pathname: "/detalle-visita/[id]", params: { id } });
    } else if (pantalla === "codigo-qr" || pantalla === "detalle-visita/[id]") {
      router.replace("/mis-visitas");
    } else {
      router.replace(pantalla === "crear-cuenta" ? "/" : "/inicio");
    }
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={regresar} style={styles.button}>
        <Text style={styles.label}>Volver</Text>
      </Pressable>
    </SafeAreaView>
  );
}

// Navegador raiz de la app. Cada pantalla de Figma corresponde a una
// ruta aquí. Sin tabs porque el recorrido es lineal (ver prototipo
// de Figma: Login -> Inicio -> Solicitar visita -> ... -> QR).
export default function RootLayout() {
  useNotificationNavigation();

  return (
    <Stack screenOptions={{
      headerShown: false,
      header: ({ route }) => (
        <EncabezadoRegreso pantalla={route.name} id={(route.params as { id?: unknown } | undefined)?.id} />
      ),
    }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="inicio" />
      <Stack.Screen name="crear-cuenta" options={mostrarRegreso} />
      <Stack.Screen name="solicitar-visita" options={mostrarRegreso} />
      <Stack.Screen name="confirmacion" options={mostrarRegreso} />
      <Stack.Screen name="consultar-historial" />
      <Stack.Screen name="mis-visitas" options={mostrarRegreso} />
      <Stack.Screen name="detalle-visita/[id]" options={mostrarRegreso} />
      <Stack.Screen name="codigo-qr" options={mostrarRegreso} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: "#FFFFFF" },
  button: { alignSelf: "flex-start", justifyContent: "center", minHeight: 44, paddingHorizontal: 24 },
  label: { color: "#171717", fontSize: 15, fontWeight: "600" },
});

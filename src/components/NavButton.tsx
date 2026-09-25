import { Pressable, Text, StyleSheet } from "react-native";
import { Href, useRouter } from "expo-router";

type NavButtonProps = {
  label: string;
  href: Href;
  dark?: boolean;
};

// Boton reutilizable para las conexiones de navegacion entre pantallas.
// Coincide con los botones "Iniciar sesion", "Enviar solicitud", etc.
// del prototipo de Figma.
export default function NavButton({ label, href, dark = true }: NavButtonProps) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(href)}
      style={[styles.button, dark ? styles.dark : styles.light]}
    >
      <Text style={dark ? styles.textLight : styles.textDark}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { paddingVertical: 14, borderRadius: 8, alignItems: "center" },
  dark: { backgroundColor: "#171717" },
  light: { backgroundColor: "#EDEDED" },
  textLight: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  textDark: { color: "#1A1A1A", fontWeight: "700", fontSize: 15 },
});

import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";

type BannerPermisoDenegadoProps = {
  visible: boolean;
};

function abrirAjustes() {
  if (Platform.OS === "ios") {
    Linking.openURL("app-settings:");
  } else {
    Linking.openSettings();
  }
}

export default function BannerPermisoDenegado({ visible }: BannerPermisoDenegadoProps) {
  if (!visible) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.content}>
        <Text style={styles.text}>
          Las notificaciones están desactivadas. No recibirás avisos sobre tus
          visitas.
        </Text>
        <Pressable onPress={abrirAjustes} style={styles.link}>
          <Text style={styles.linkText}>Activar en Ajustes</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#FEF3C7",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  text: { flex: 1, fontSize: 13, color: "#92400E", lineHeight: 18 },
  link: { paddingVertical: 4, paddingHorizontal: 8 },
  linkText: { fontSize: 13, fontWeight: "700", color: "#92400E", textDecorationLine: "underline" },
});

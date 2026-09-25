import { View, Text, StyleSheet } from "react-native";
import Screen from "../components/Screen";
import NavButton from "../components/NavButton";

// Pantalla 7: Codigo QR (HU-06)
// TODO Sprint 7: reemplazar el recuadro gris por el QR real
// (por ejemplo con react-native-qrcode-svg) generado por el backend
export default function CodigoQrScreen() {
  return (
    <Screen
      title="Tu codigo de acceso"
      subtitle="Muestra este codigo en la caseta de vigilancia"
    >
      <View style={styles.qrPlaceholder}>
        <Text style={styles.qrText}>QR</Text>
      </View>
      <NavButton label="Volver" href="/detalle-visita/1" dark={false} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  qrPlaceholder: {
    width: 220,
    height: 220,
    borderRadius: 12,
    backgroundColor: "#EBEBEB",
    borderWidth: 1,
    borderColor: "#BFBFBF",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  qrText: { color: "#999999", fontSize: 18, fontWeight: "700" },
});

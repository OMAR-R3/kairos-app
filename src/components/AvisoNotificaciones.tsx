import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type AvisoNotificacionesProps = {
  visible: boolean;
  onAceptar: () => void;
  onCancelar: () => void;
};

export default function AvisoNotificaciones({
  visible,
  onAceptar,
  onCancelar,
}: AvisoNotificacionesProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.icon}>🔔</Text>
          <Text style={styles.title}>Activar notificaciones</Text>
          <Text style={styles.body}>
            Te avisaremos cuando tu visita sea aprobada o cancelada para que no
            tengas que revisar la app manualmente.
          </Text>

          <Pressable style={styles.btnPrimary} onPress={onAceptar}>
            <Text style={styles.btnPrimaryText}>Activar</Text>
          </Pressable>

          <Pressable style={styles.btnSecondary} onPress={onCancelar}>
            <Text style={styles.btnSecondaryText}>Ahora no</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
  },
  icon: { fontSize: 40, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: "700", color: "#111111", marginBottom: 8 },
  body: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  btnPrimary: {
    backgroundColor: "#171717",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    width: "100%",
  },
  btnPrimaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  btnSecondary: {
    paddingVertical: 12,
    alignItems: "center",
    width: "100%",
    marginTop: 4,
  },
  btnSecondaryText: { color: "#999999", fontWeight: "600", fontSize: 14 },
});

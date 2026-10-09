import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";
import Campo from "../components/Campo";
import NavButton from "../components/NavButton";
import Screen from "../components/Screen";
import { VisitasService } from "../services/VisitasService";
import { VisitaErrors, VisitaForm, validateVisitaForm } from "../utils/validators";

const FORM_INICIAL: VisitaForm = {
  motivo: "",
  area: "",
  fecha: "",
};

// Pantalla 3: Solicitar visita (HU-02)
export default function SolicitarVisitaScreen() {
  const router = useRouter();
  const [form, setForm] = useState<VisitaForm>(FORM_INICIAL);
  const [errors, setErrors] = useState<VisitaErrors>({});
  const [loading, setLoading] = useState(false);

  const setCampo = (campo: keyof VisitaForm) => (texto: string) => {
    setForm((prev) => ({ ...prev, [campo]: texto }));
    if (errors[campo]) setErrors((prev) => ({ ...prev, [campo]: undefined }));
  };

  const handleSubmit = async () => {
    const { valid, errors: errs } = validateVisitaForm(form);
    setErrors(errs);
    if (!valid) return;

    setLoading(true);
    try {
      const visita = await VisitasService.agendarVisita({
        motivo: form.motivo.trim(),
        area: form.area.trim(),
        fecha: form.fecha.trim(),
      });
      router.replace({
        pathname: "/confirmacion",
        params: { folio: visita.folio },
      });
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "No se pudo agendar la visita";
      Alert.alert("Error", mensaje);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Nueva visita" subtitle="Completa los datos de tu visita">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <Campo
            label="Motivo de la visita"
            value={form.motivo}
            onChangeText={setCampo("motivo")}
            error={errors.motivo}
            autoCapitalize="words"
          />
          <Campo
            label="Area a visitar"
            value={form.area}
            onChangeText={setCampo("area")}
            error={errors.area}
            autoCapitalize="words"
          />
          <Campo
            label="Fecha (AAAA-MM-DD)"
            value={form.fecha}
            onChangeText={setCampo("fecha")}
            error={errors.fecha}
            maxLength={10}
          />

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={[styles.button, loading && styles.buttonDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Enviar solicitud</Text>
            )}
          </Pressable>

          <NavButton label="Cancelar" href="/inicio" dark={false} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 12, paddingBottom: 32 },
  button: { paddingVertical: 14, borderRadius: 8, alignItems: "center", backgroundColor: "#171717" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
});

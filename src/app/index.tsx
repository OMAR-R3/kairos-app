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
import {
  LoginFormErrors,
  LoginFormValues,
  validateLoginForm,
} from "../utils/validators";

const FORM_INICIAL: LoginFormValues = {
  email: "",
  password: "",
};

// Pantalla: Login (HU-01)
export default function LoginScreen() {
  const router = useRouter();
  const [form, setForm] = useState<LoginFormValues>(FORM_INICIAL);
  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [loading, setLoading] = useState(false);

  const setCampo = (campo: keyof LoginFormValues) => (texto: string) => {
    setForm((prev) => ({ ...prev, [campo]: texto }));
    if (errors[campo]) setErrors((prev) => ({ ...prev, [campo]: undefined }));
  };

  const handleSubmit = async () => {
    const { valid, errors: errs } = validateLoginForm(form);
    setErrors(errs);
    if (!valid) return;

    setLoading(true);
    try {
      await VisitasService.login({
        correo: form.email.trim().toLowerCase(),
        password: form.password,
      });
      router.replace("/inicio");
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "No se pudo iniciar sesion";
      Alert.alert("Error", mensaje);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      title="Kairos Visitas"
      subtitle="Inicia sesion con tu cuenta del Extranet de Kairos"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <Campo
            label="Correo"
            value={form.email}
            onChangeText={setCampo("email")}
            error={errors.email}
            keyboardType="email-address"
          />
          <Campo
            label="Contrasena"
            value={form.password}
            onChangeText={setCampo("password")}
            error={errors.password}
            secure
          />

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={[styles.button, loading && styles.buttonDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Iniciar sesion</Text>
            )}
          </Pressable>

          <NavButton label="Crear cuenta" href="/crear-cuenta" dark={false} />
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
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
  Text
} from "react-native";
import Campo from "../components/Campo";
import NavButton from "../components/NavButton";
import Screen from "../components/Screen";
import { VisitasService } from "../services/VisitasService";
import {
  RegistroErrors,
  RegistroForm,
  validateRegistroForm,
} from "../utils/validators";

const FORM_INICIAL: RegistroForm = {
  nombre: "",
  apellidoPaterno: "",
  apellidoMaterno: "",
  correo: "",
  telefono: "",
  password: "",
  confirmarPassword: "",
};

// Pantalla: Crear cuenta (arrastre Sprint 1 / HU-01)
export default function CrearCuentaScreen() {
  const router = useRouter();
  const [form, setForm] = useState<RegistroForm>(FORM_INICIAL);
  const [errors, setErrors] = useState<RegistroErrors>({});
  const [loading, setLoading] = useState(false);

  const setCampo = (campo: keyof RegistroForm) => (texto: string) => {
    setForm((prev) => ({ ...prev, [campo]: texto }));
    // Limpia el error del campo cuando el usuario vuelve a escribir
    if (errors[campo]) setErrors((prev) => ({ ...prev, [campo]: undefined }));
  };

  const handleSubmit = async () => {
    const { valid, errors: errs, values } = validateRegistroForm(form);
    setErrors(errs);
    if (!valid) return;

    setLoading(true);
    try {
      await VisitasService.registrarVisitante(values);
      Alert.alert("Cuenta creada", "Ya puedes iniciar sesion con tu correo.", [
        // Regresa a Login. Si en Figma va directo a Inicio, cambiar a "/inicio"
        { text: "Aceptar", onPress: () => router.replace("/") },
      ]);
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "No se pudo crear la cuenta";
      Alert.alert("Error", mensaje);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Crear cuenta" subtitle="Registrate para consultar tus visitas">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <Campo label="Nombre(s)" value={form.nombre} onChangeText={setCampo("nombre")}
            error={errors.nombre} autoCapitalize="words" />
          <Campo label="Apellido paterno" value={form.apellidoPaterno}
            onChangeText={setCampo("apellidoPaterno")} error={errors.apellidoPaterno}
            autoCapitalize="words" />
          <Campo label="Apellido materno (opcional)" value={form.apellidoMaterno}
            onChangeText={setCampo("apellidoMaterno")} error={errors.apellidoMaterno}
            autoCapitalize="words" />
          <Campo label="Correo" value={form.correo} onChangeText={setCampo("correo")}
            error={errors.correo} keyboardType="email-address" />
          {/* Quitar este Campo si el backend deja el telefono opcional */}
          <Campo label="Telefono (10 digitos)" value={form.telefono}
            onChangeText={setCampo("telefono")} error={errors.telefono}
            keyboardType="phone-pad" maxLength={14} />
          <Campo label="Contrasena" value={form.password} onChangeText={setCampo("password")}
            error={errors.password} secure />
          <Campo label="Confirmar contrasena" value={form.confirmarPassword}
            onChangeText={setCampo("confirmarPassword")} error={errors.confirmarPassword} secure />

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={[styles.button, loading && styles.buttonDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Crear cuenta</Text>
            )}
          </Pressable>

          <NavButton label="Ya tengo cuenta" href="/" dark={false} />
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

import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Campo from "../components/Campo";
import NavButton from "../components/NavButton";
import Screen from "../components/Screen";
import { Departamento, VisitasService } from "../services/VisitasService";
import { VisitaErrors, VisitaForm, validateVisitaForm } from "../utils/validators";

let DateTimePicker: React.ComponentType<any> | null = null;
try {
  DateTimePicker = require("@react-native-community/datetimepicker").default;
} catch {
  // fallback: campo de texto
}

const FORM_INICIAL: VisitaForm = {
  departamento: "",
  fecha: "",
  horaLlegada: "",
  motivo: "",
};

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export default function SolicitarVisitaScreen() {
  const router = useRouter();
  const [form, setForm] = useState<VisitaForm>(FORM_INICIAL);
  const [errors, setErrors] = useState<VisitaErrors>({});
  const [loading, setLoading] = useState(false);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempTime, setTempTime] = useState(new Date());

  useEffect(() => {
    VisitasService.obtenerDepartamentos()
      .then(setDepartamentos)
      .catch(() => {});
  }, []);

  const setCampo = (campo: keyof VisitaForm) => (texto: string) => {
    setForm((prev) => ({ ...prev, [campo]: texto }));
    if (errors[campo]) setErrors((prev) => ({ ...prev, [campo]: undefined }));
  };

  // --- Date picker ---
  const handleDateChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (selectedDate) {
      setTempDate(selectedDate);
      if (Platform.OS === "android") setCampo("fecha")(formatDate(selectedDate));
    }
  };

  const confirmDateIOS = () => {
    setCampo("fecha")(formatDate(tempDate));
    setShowDatePicker(false);
  };

  // --- Time picker ---
  const handleTimeChange = (_event: unknown, selectedTime?: Date) => {
    if (Platform.OS === "android") setShowTimePicker(false);
    if (selectedTime) {
      setTempTime(selectedTime);
      if (Platform.OS === "android") setCampo("horaLlegada")(formatTime(selectedTime));
    }
  };

  const confirmTimeIOS = () => {
    setCampo("horaLlegada")(formatTime(tempTime));
    setShowTimePicker(false);
  };

  const handleSubmit = async () => {
    const { valid, errors: errs } = validateVisitaForm(form);
    setErrors(errs);
    if (!valid) return;

    setLoading(true);
    try {
      const deptoId = Number(form.departamento);
      const { folio } = await VisitasService.agendarVisita({
        depto_id: deptoId,
        fecha: form.fecha.trim(),
        hora_inicio: form.horaLlegada.trim() + ":00",
        motivo: form.motivo.trim(),
      });
      router.replace({
        pathname: "/confirmacion",
        params: { folio },
      });
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "No se pudo agendar la visita";
      Alert.alert("Error", mensaje);
    } finally {
      setLoading(false);
    }
  };

  const deptOptions = [
    { label: "Seleccionar....", value: "" },
    ...departamentos.map((d) => ({ label: d.nombre, value: String(d.id) })),
  ];

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return (
    <Screen title="Nueva visita" subtitle="Completa los datos de tu visita">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <Text style={styles.seccion}>Detalles de la visita</Text>

          <CampoSelector
            label="Departamento a visitar"
            value={form.departamento}
            onChange={setCampo("departamento")}
            options={deptOptions}
            error={errors.departamento}
          />

          {/* Fecha con calendario */}
          <View style={pickerFieldStyles.campo}>
            <Text style={pickerFieldStyles.label}>Fecha de cita (Lunes a viernes)</Text>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={[
                pickerFieldStyles.input,
                errors.fecha ? pickerFieldStyles.inputError : null,
              ]}
            >
              <Text style={form.fecha ? pickerFieldStyles.text : pickerFieldStyles.placeholder}>
                {form.fecha ? formatDateDisplay(form.fecha) : "dd/mm/aaaa"}
              </Text>
            </Pressable>
            {errors.fecha ? <Text style={pickerFieldStyles.error}>{errors.fecha}</Text> : null}
          </View>

          {showDatePicker && DateTimePicker && (
            Platform.OS === "ios" ? (
              <View style={nativePickerStyles.iosContainer}>
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="spinner"
                  onChange={(_e: unknown, d?: Date) => { if (d) setTempDate(d); }}
                  minimumDate={tomorrow}
                />
                <View style={nativePickerStyles.iosButtons}>
                  <Pressable onPress={() => setShowDatePicker(false)}>
                    <Text style={nativePickerStyles.cancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable onPress={confirmDateIOS}>
                    <Text style={nativePickerStyles.confirmText}>Aceptar</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="default"
                onChange={handleDateChange}
                minimumDate={tomorrow}
              />
            )
          )}

          {/* Hora con reloj */}
          <View style={pickerFieldStyles.campo}>
            <Text style={pickerFieldStyles.label}>Hora de llegada</Text>
            <Pressable
              onPress={() => setShowTimePicker(true)}
              style={[
                pickerFieldStyles.input,
                errors.horaLlegada ? pickerFieldStyles.inputError : null,
              ]}
            >
              <Text style={form.horaLlegada ? pickerFieldStyles.text : pickerFieldStyles.placeholder}>
                {form.horaLlegada || "hh:mm"}
              </Text>
            </Pressable>
            {errors.horaLlegada ? <Text style={pickerFieldStyles.error}>{errors.horaLlegada}</Text> : null}
          </View>

          {showTimePicker && DateTimePicker && (
            Platform.OS === "ios" ? (
              <View style={nativePickerStyles.iosContainer}>
                <DateTimePicker
                  value={tempTime}
                  mode="time"
                  display="spinner"
                  is24Hour
                  onChange={(_e: unknown, t?: Date) => { if (t) setTempTime(t); }}
                />
                <View style={nativePickerStyles.iosButtons}>
                  <Pressable onPress={() => setShowTimePicker(false)}>
                    <Text style={nativePickerStyles.cancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable onPress={confirmTimeIOS}>
                    <Text style={nativePickerStyles.confirmText}>Aceptar</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <DateTimePicker
                value={tempTime}
                mode="time"
                display="default"
                is24Hour
                onChange={handleTimeChange}
              />
            )
          )}

          <Campo
            label="Motivo de la visita"
            value={form.motivo}
            onChangeText={setCampo("motivo")}
            placeholder="Escribe el motivo"
            error={errors.motivo}
            multiline
          />

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={[styles.button, loading && styles.buttonDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Enviar solicitud de visita</Text>
            )}
          </Pressable>

          <NavButton label="Cancelar" href="/inicio" dark={false} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

type SelectorProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  error?: string;
};

function CampoSelector({ label, value, onChange, options, error }: SelectorProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={selectorStyles.campo}>
      <Text style={selectorStyles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(!open)}
        style={[selectorStyles.input, error ? selectorStyles.inputError : null]}
      >
        <Text style={value ? selectorStyles.text : selectorStyles.placeholder}>
          {selected?.label ?? "Seleccionar...."}
        </Text>
      </Pressable>
      {open && (
        <View style={selectorStyles.dropdown}>
          {options.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              style={selectorStyles.option}
            >
              <Text style={selectorStyles.optionText}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {error ? <Text style={selectorStyles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 12, paddingBottom: 32 },
  seccion: { fontSize: 16, fontWeight: "700", color: "#1A1A1A", marginTop: 8 },
  button: { paddingVertical: 14, borderRadius: 24, alignItems: "center", backgroundColor: "#171717", marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
});

const pickerFieldStyles = StyleSheet.create({
  campo: { gap: 4 },
  label: { fontSize: 13, fontWeight: "600", color: "#1A1A1A" },
  input: {
    borderWidth: 1, borderColor: "#CFCFCF", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 12, backgroundColor: "#FFFFFF",
  },
  inputError: { borderColor: "#C62828" },
  text: { fontSize: 15, color: "#1A1A1A" },
  placeholder: { fontSize: 15, color: "#999" },
  error: { color: "#C62828", fontSize: 12 },
});

const selectorStyles = StyleSheet.create({
  campo: { gap: 4 },
  label: { fontSize: 13, fontWeight: "600", color: "#1A1A1A" },
  input: {
    borderWidth: 1, borderColor: "#CFCFCF", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 12, backgroundColor: "#FFFFFF",
  },
  inputError: { borderColor: "#C62828" },
  text: { fontSize: 15, color: "#1A1A1A" },
  placeholder: { fontSize: 15, color: "#999" },
  dropdown: {
    borderWidth: 1, borderColor: "#CFCFCF", borderRadius: 8,
    backgroundColor: "#FFFFFF", marginTop: 2,
  },
  option: { paddingHorizontal: 12, paddingVertical: 10 },
  optionText: { fontSize: 15, color: "#1A1A1A" },
  error: { color: "#C62828", fontSize: 12 },
});

const nativePickerStyles = StyleSheet.create({
  iosContainer: {
    backgroundColor: "#FFFFFF", borderRadius: 12,
    borderWidth: 1, borderColor: "#CFCFCF", padding: 8,
  },
  iosButtons: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 8,
  },
  cancelText: { fontSize: 15, color: "#999" },
  confirmText: { fontSize: 15, fontWeight: "700", color: "#171717" },
});

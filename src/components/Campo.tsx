import {
    KeyboardTypeOptions,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

export type CampoProps = {
    label: string;
    value: string;
    onChangeText: (t: string) => void;
    error?: string;
    keyboardType?: KeyboardTypeOptions;
    secure?: boolean;
    autoCapitalize?: "none" | "words";
    maxLength?: number;
};

// Campo de texto con etiqueta y mensaje de error.
// Compartido entre las pantallas de Login y Crear cuenta.
export default function Campo({
    label, value, onChangeText, error, keyboardType,
    secure = false, autoCapitalize = "none", maxLength,
}: CampoProps) {
    return (
        <View style={styles.campo}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
                value={value}
                onChangeText={onChangeText}
                keyboardType={keyboardType}
                secureTextEntry={secure}
                autoCapitalize={autoCapitalize}
                autoCorrect={false}
                maxLength={maxLength}
                style={[styles.input, error ? styles.inputError : null]}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    campo: { gap: 4 },
    label: { fontSize: 13, fontWeight: "600", color: "#1A1A1A" },
    input: {
        borderWidth: 1, borderColor: "#CFCFCF", borderRadius: 8,
        paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, backgroundColor: "#FFFFFF",
    },
    inputError: { borderColor: "#C62828" },
    error: { color: "#C62828", fontSize: 12 },
});
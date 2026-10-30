import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const AVISO_KEY = "kairos_push_aviso_visto";
const PUSH_KEY = "kairos_expo_push_token";

export const NotificacionesService = {
  disponible: () =>
    Device.isDevice && (Platform.OS === "android" || Platform.OS === "ios") &&
    Constants.executionEnvironment !== "storeClient",

  consultarPermiso: () => Notifications.getPermissionsAsync(),
  avisoVisto: () => SecureStore.getItemAsync(AVISO_KEY),
  recordarAviso: () => SecureStore.setItemAsync(AVISO_KEY, "1"),
  tokenGuardado: () => SecureStore.getItemAsync(PUSH_KEY),
  olvidarToken: () => SecureStore.deleteItemAsync(PUSH_KEY),

  async prepararCanal(): Promise<void> {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Visitas",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
  },

  async solicitarPermiso() {
    // El canal debe existir antes de solicitar el permiso en Android 13+.
    await this.prepararCanal();
    return Notifications.requestPermissionsAsync();
  },

  async obtenerToken(): Promise<string> {
    await this.prepararCanal();
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) throw new Error("Falta el identificador del proyecto EAS");
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  },

  guardarToken: (token: string) => SecureStore.setItemAsync(PUSH_KEY, token),
};

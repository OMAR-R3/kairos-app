import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { NotificacionesService } from "@/services/NotificacionesService";

jest.mock("expo-notifications", () => ({
  __esModule: true,
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getExpoPushTokenAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
}));
jest.mock("expo-device", () => ({ __esModule: true, isDevice: true }));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    executionEnvironment: "bare",
    expoConfig: { extra: { eas: { projectId: "proyecto-eas" } } },
    easConfig: undefined,
  },
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockNotif = Notifications as jest.Mocked<typeof Notifications>;
const constantes = Constants as any;
const dispositivo = Device as any;

describe("NotificacionesService: permiso", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = "android";
  });

  it("permiso otorgado: pide el permiso y devuelve granted", async () => {
    mockNotif.requestPermissionsAsync.mockResolvedValue({
      granted: true,
      status: "granted",
      canAskAgain: true,
    } as any);

    const r = await NotificacionesService.solicitarPermiso();

    expect(r.granted).toBe(true);
    expect(mockNotif.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("permiso negado: devuelve denied y no lanza error", async () => {
    mockNotif.requestPermissionsAsync.mockResolvedValue({
      granted: false,
      status: "denied",
      canAskAgain: false,
    } as any);

    const r = await NotificacionesService.solicitarPermiso();

    expect(r.granted).toBe(false);
    expect(r.status).toBe("denied");
  });

  it("en Android crea el canal antes de pedir el permiso", async () => {
    const orden: string[] = [];
    mockNotif.setNotificationChannelAsync.mockImplementation(async () => {
      orden.push("canal");
      return null as any;
    });
    mockNotif.requestPermissionsAsync.mockImplementation(async () => {
      orden.push("permiso");
      return { granted: true, status: "granted" } as any;
    });

    await NotificacionesService.solicitarPermiso();

    expect(orden).toEqual(["canal", "permiso"]);
    expect(mockNotif.setNotificationChannelAsync).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({ name: "Visitas", importance: 4 })
    );
  });

  it("en iOS no crea canal de notificaciones", async () => {
    (Platform as any).OS = "ios";
    mockNotif.requestPermissionsAsync.mockResolvedValue({ granted: true } as any);

    await NotificacionesService.solicitarPermiso();

    expect(mockNotif.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it("consultarPermiso lee el estado actual sin pedirlo", async () => {
    mockNotif.getPermissionsAsync.mockResolvedValue({ status: "undetermined" } as any);

    const r = await NotificacionesService.consultarPermiso();

    expect(r.status).toBe("undetermined");
    expect(mockNotif.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe("NotificacionesService: token de Expo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = "android";
    constantes.expoConfig = { extra: { eas: { projectId: "proyecto-eas" } } };
    constantes.easConfig = undefined;
  });

  it("obtiene el token con el projectId de EAS", async () => {
    mockNotif.getExpoPushTokenAsync.mockResolvedValue({
      type: "expo",
      data: "ExponentPushToken[abc123]",
    } as any);

    const token = await NotificacionesService.obtenerToken();

    expect(token).toBe("ExponentPushToken[abc123]");
    expect(mockNotif.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: "proyecto-eas",
    });
  });

  it("usa easConfig cuando expoConfig no trae el projectId", async () => {
    constantes.expoConfig = { extra: {} };
    constantes.easConfig = { projectId: "desde-eas-config" };
    mockNotif.getExpoPushTokenAsync.mockResolvedValue({ data: "ExponentPushToken[x]" } as any);

    await NotificacionesService.obtenerToken();

    expect(mockNotif.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: "desde-eas-config",
    });
  });

  it("lanza un error claro si falta el projectId", async () => {
    constantes.expoConfig = { extra: {} };

    await expect(NotificacionesService.obtenerToken()).rejects.toThrow(
      "Falta el identificador del proyecto EAS"
    );
    expect(mockNotif.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });
});

describe("NotificacionesService: disponibilidad", () => {
  beforeEach(() => {
    (Platform as any).OS = "android";
    dispositivo.isDevice = true;
    constantes.executionEnvironment = "bare";
  });

  it("está disponible en un teléfono real con development build", () => {
    expect(NotificacionesService.disponible()).toBe(true);
  });

  it("no está disponible en un emulador", () => {
    dispositivo.isDevice = false;
    expect(NotificacionesService.disponible()).toBe(false);
  });

  it("no está disponible dentro de Expo Go", () => {
    constantes.executionEnvironment = "storeClient";
    expect(NotificacionesService.disponible()).toBe(false);
  });

  it("no está disponible en web", () => {
    (Platform as any).OS = "web";
    expect(NotificacionesService.disponible()).toBe(false);
  });
});

import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { VisitasService } from "../services/VisitasService";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type AccionNotificacion =
  | { tipo: "navegar"; visitaId: string }
  | { tipo: "sesion-expirada" }
  | { tipo: "ignorar" };

export function resolverAccion(
  data: Record<string, unknown> | undefined,
  sesionActiva: boolean,
): AccionNotificacion {
  const visitaId = String(data?.visita_id ?? "");
  if (!visitaId || !/^[1-9]\d*$/.test(visitaId)) return { tipo: "ignorar" };
  if (!sesionActiva) return { tipo: "sesion-expirada" };
  return { tipo: "navegar", visitaId };
}

export default function useNotificationNavigation() {
  const router = useRouter();
  const ultimaId = useRef<string | null>(null);
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!lastResponse) return;

    const responseId = lastResponse.notification.request.identifier;
    if (ultimaId.current === responseId) return;
    ultimaId.current = responseId;

    const data = lastResponse.notification.request.content.data as
      | Record<string, unknown>
      | undefined;

    VisitasService.restaurarSesion().then((activa) => {
      const accion = resolverAccion(data, activa);

      if (accion.tipo === "navegar") {
        router.push(`/detalle-visita/${accion.visitaId}` as Href);
      } else if (accion.tipo === "sesion-expirada") {
        Alert.alert("Sesión expirada", "Tu sesión expiró, inicia sesión de nuevo");
        router.replace("/");
      }
    });
  }, [lastResponse, router]);
}

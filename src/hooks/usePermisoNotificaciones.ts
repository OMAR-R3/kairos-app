import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { NotificacionesService } from "../services/NotificacionesService";
import { VisitasService } from "../services/VisitasService";

export default function usePermisoNotificaciones() {
  const [mostrarAviso, setMostrarAviso] = useState(false);
  const [permisoDenegado, setPermisoDenegado] = useState(false);
  const acciones = useRef({ aceptar: async () => {}, cancelar: async () => {} });

  useEffect(() => {
    if (!NotificacionesService.disponible()) return;
    let activo = true;
    let ocupado = false;
    let pendiente = false;
    const generacion = VisitasService.generacionSesionPush();
    const vigente = () => activo && generacion === VisitasService.generacionSesionPush();

    const actualizar = async () => {
      if (!vigente()) return;
      if (ocupado) {
        pendiente = true;
        return;
      }
      ocupado = true;
      try {
        const permiso = await NotificacionesService.consultarPermiso();
        const visto = await NotificacionesService.avisoVisto();
        if (!vigente()) return;
        setPermisoDenegado(permiso.status === "denied");
        setMostrarAviso(!permiso.granted && permiso.status === "undetermined" &&
          permiso.canAskAgain && !visto);
        if (permiso.granted) {
          const token = await NotificacionesService.obtenerToken();
          if (!vigente()) return;
          const plataforma = Platform.OS;
          if (plataforma === "android" || plataforma === "ios") {
            await VisitasService.registrarTokenPush(token, plataforma, generacion);
          }
        } else {
          const token = await NotificacionesService.tokenGuardado();
          if (token && vigente()) await VisitasService.eliminarTokenPush(token, generacion);
        }
      } catch {
        // Sin permisos o sin red, el resto de la aplicación sigue disponible.
      } finally {
        ocupado = false;
        if (pendiente && vigente()) {
          pendiente = false;
          void actualizar();
        }
      }
    };

    let decidiendo = false;
    const decidir = async (aceptar: boolean) => {
      if (decidiendo || !vigente()) return;
      decidiendo = true;
      setMostrarAviso(false);
      try {
        // Recordar también «Ahora no», incluso entre reinicios y cuentas.
        await NotificacionesService.recordarAviso();
        if (aceptar && vigente()) await NotificacionesService.solicitarPermiso();
        await actualizar();
      } catch {
        // Un fallo de permisos/almacenamiento no bloquea Inicio.
      } finally {
        decidiendo = false;
      }
    };
    acciones.current = {
      aceptar: () => decidir(true),
      cancelar: () => decidir(false),
    };
    void actualizar();
    const suscripcion = AppState.addEventListener("change", (estado) => {
      if (estado === "active") void actualizar();
    });
    return () => {
      activo = false;
      suscripcion.remove();
    };
  }, []);

  return {
    mostrarAviso,
    permisoDenegado,
    aceptar: () => { void acciones.current.aceptar(); },
    cancelar: () => { void acciones.current.cancelar(); },
  };
}

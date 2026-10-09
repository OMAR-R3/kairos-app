# Casos de Prueba — HU-02: Solicitar Visita

**Historia de usuario:** Como visitante, quiero agendar una visita seleccionando departamento, fecha, hora y motivo para que mi solicitud quede registrada.

**Fecha:** 2026-10-09
**Responsable:** Miriam Ruiz
**Archivos involucrados:**
- `src/app/solicitar-visita.tsx`
- `src/utils/validators.ts` → `validateVisitaForm()`
- `src/services/VisitasService.ts` → `agendarVisita()`
- `src/utils/__tests__/validators.test.ts`
- `src/utils/__tests__/VisitasService.test.ts`

---

## CP-03: Solicitud de visita exitosa (camino feliz)

| Campo | Detalle |
|---|---|
| **Precondiciones** | Usuario autenticado con sesion activa. API disponible. |
| **Datos de entrada** | Departamento: "Vinculacion", Fecha: 2026-10-12 (lunes), Hora: 10:00, Motivo: "Reunion de seguimiento" |
| **Pasos** | 1. Navegar a "Solicitar visita" desde la pantalla de inicio. 2. Seleccionar departamento del dropdown. 3. Tap en el campo de fecha → se abre el calendario nativo → seleccionar fecha. 4. Tap en el campo de hora → se abre el reloj nativo → seleccionar hora. 5. Escribir el motivo. 6. Presionar "Enviar solicitud de visita". |
| **Resultado esperado** | La app redirige a la pantalla de confirmacion mostrando el folio asignado (formato KV-XXXXXX). |
| **Resultado obtenido** | La solicitud se envia correctamente. El servicio retorna el folio y la app navega a `/confirmacion` con el folio visible. |
| **Estado** | PASA |

---

## CP-04: Campos vacios — todos los campos sin llenar

| Campo | Detalle |
|---|---|
| **Precondiciones** | Usuario autenticado. Formulario en blanco. |
| **Datos de entrada** | Departamento: (vacio), Fecha: (vacia), Hora: (vacia), Motivo: (vacio) |
| **Pasos** | 1. Abrir la pantalla "Solicitar visita". 2. Sin llenar ningun campo, presionar "Enviar solicitud de visita". |
| **Resultado esperado** | No se envia el formulario. Se muestran mensajes de error debajo de cada campo: "Selecciona un departamento", "La fecha es obligatoria", "La hora es obligatoria", "El motivo es obligatorio". |
| **Resultado obtenido** | La validacion `validateVisitaForm()` retorna `valid: false` con errores en los 4 campos. Los mensajes se renderizan en rojo debajo de cada campo. No se realiza ninguna peticion HTTP. |
| **Estado** | PASA |

---

## CP-05: Campos vacios — solo un campo sin llenar (departamento)

| Campo | Detalle |
|---|---|
| **Precondiciones** | Usuario autenticado. |
| **Datos de entrada** | Departamento: (vacio), Fecha: 2026-10-12, Hora: 09:00, Motivo: "Entrega de documentos" |
| **Pasos** | 1. Llenar fecha, hora y motivo correctamente. 2. Dejar departamento sin seleccionar. 3. Presionar "Enviar solicitud de visita". |
| **Resultado esperado** | Error solo en departamento: "Selecciona un departamento". Los demas campos no muestran error. |
| **Resultado obtenido** | Solo aparece el error en el campo departamento. El formulario no se envia. |
| **Estado** | PASA |

---

## CP-06: Fecha en fin de semana

| Campo | Detalle |
|---|---|
| **Precondiciones** | Usuario autenticado. |
| **Datos de entrada** | Departamento: "Sistemas", Fecha: 2026-10-10 (sabado), Hora: 10:00, Motivo: "Revision" |
| **Pasos** | 1. Llenar todos los campos. 2. Seleccionar una fecha que caiga en sabado o domingo. 3. Presionar "Enviar solicitud de visita". |
| **Resultado esperado** | Error en fecha: "Solo se permiten dias de lunes a viernes". |
| **Resultado obtenido** | La validacion detecta que el dia es sabado (`getDay() === 6`) y muestra el mensaje de error. No se envia la solicitud. |
| **Estado** | PASA |

---

## CP-07: Fecha en el pasado

| Campo | Detalle |
|---|---|
| **Precondiciones** | Usuario autenticado. |
| **Datos de entrada** | Departamento: "Sistemas", Fecha: 2026-09-01 (pasada), Hora: 10:00, Motivo: "Reunion" |
| **Pasos** | 1. Llenar todos los campos con una fecha anterior a hoy. 2. Presionar "Enviar solicitud de visita". |
| **Resultado esperado** | Error en fecha: "La fecha no puede ser en el pasado". |
| **Resultado obtenido** | La validacion compara la fecha con la fecha actual y muestra el error. Adicionalmente, el DateTimePicker nativo tiene `minimumDate` configurado al dia de manana, lo que previene seleccionar fechas pasadas desde el calendario. |
| **Estado** | PASA |

---

## CP-08: Motivo sin letras (solo numeros o simbolos)

| Campo | Detalle |
|---|---|
| **Precondiciones** | Usuario autenticado. |
| **Datos de entrada** | Departamento: "Vinculacion", Fecha: 2026-10-12, Hora: 10:00, Motivo: "12345!!!" |
| **Pasos** | 1. Llenar todos los campos correctamente excepto el motivo. 2. Escribir solo numeros y simbolos en el motivo. 3. Presionar "Enviar solicitud de visita". |
| **Resultado esperado** | Error en motivo: "El motivo debe contener letras". |
| **Resultado obtenido** | La regex `/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/` no encuentra letras y muestra el error. |
| **Estado** | PASA |

---

## CP-09: Visita duplicada (HTTP 409)

| Campo | Detalle |
|---|---|
| **Precondiciones** | Usuario autenticado. Ya existe una visita registrada con los mismos datos. |
| **Datos de entrada** | Departamento: "Vinculacion" (id 3), Fecha: 2026-10-12, Hora: 10:00, Motivo: "Reunion" |
| **Pasos** | 1. Llenar el formulario con datos identicos a una visita ya registrada. 2. Presionar "Enviar solicitud de visita". |
| **Resultado esperado** | La API responde con HTTP 409. La app muestra un Alert con el mensaje "Ya tienes una visita registrada con esos datos". El formulario permanece visible para que el usuario modifique los datos. |
| **Resultado obtenido** | `VisitasService.agendarVisita()` detecta el status 409 y lanza el error. El `catch` en `handleSubmit` muestra el Alert. El boton se rehabilita al terminar (`finally`). |
| **Estado** | PASA |
| **Test unitario** | `VisitasService.test.ts` → "409 da mensaje de duplicada" |

---

## CP-10: Sesion vencida (HTTP 401)

| Campo | Detalle |
|---|---|
| **Precondiciones** | Usuario tenia sesion activa pero el token JWT ya expiro. |
| **Datos de entrada** | Cualquier dato valido en el formulario. |
| **Pasos** | 1. Llenar el formulario correctamente. 2. Presionar "Enviar solicitud de visita" cuando el token ya expiro. |
| **Resultado esperado** | La API responde con HTTP 401. La app borra el token almacenado y lanza `SesionExpiradaError` con el mensaje "Tu sesion expiro, inicia sesion de nuevo". Se muestra un Alert con ese mensaje. |
| **Resultado obtenido** | `peticionAutenticada()` detecta el 401, ejecuta `SecureStore.deleteItemAsync(TOKEN_KEY)` y lanza `SesionExpiradaError`. El `catch` en `handleSubmit` captura el error y muestra el Alert. |
| **Estado** | PASA |
| **Test unitario** | `VisitasService.test.ts` → "401 borra el token y lanza SesionExpiradaError" |

---

## CP-11: Error generico del servidor (HTTP 500)

| Campo | Detalle |
|---|---|
| **Precondiciones** | Usuario autenticado. La API tiene un error interno. |
| **Datos de entrada** | Cualquier dato valido en el formulario. |
| **Pasos** | 1. Llenar el formulario correctamente. 2. Presionar "Enviar solicitud de visita" cuando el servidor responde 500. |
| **Resultado esperado** | La app muestra un Alert con "No se pudo agendar la visita" (o el mensaje que el servidor envie en el body). El formulario permanece visible. |
| **Resultado obtenido** | El servicio cae en el bloque `if (!res.ok)`, extrae el mensaje del body o usa el fallback. El Alert se muestra y el boton se rehabilita. |
| **Estado** | PASA |

---

## CP-12: Folio generado con formato correcto

| Campo | Detalle |
|---|---|
| **Precondiciones** | Solicitud enviada exitosamente. |
| **Datos de entrada** | Respuesta de la API con `id: 21`. |
| **Pasos** | 1. Enviar solicitud exitosa. 2. Verificar el folio en la pantalla de confirmacion. |
| **Resultado esperado** | El folio tiene formato `KV-XXXXXX` (6 digitos con ceros a la izquierda). Para id 21: `KV-000021`. |
| **Resultado obtenido** | `generarFolio(21)` retorna `"KV-000021"`. |
| **Estado** | PASA |
| **Test unitario** | `VisitasService.test.ts` → "genera folio con 6 digitos" |

---

## Resumen de cobertura

| ID | Caso de prueba | Estado |
|---|---|---|
| CP-03 | Solicitud exitosa (camino feliz) | PASA |
| CP-04 | Todos los campos vacios | PASA |
| CP-05 | Un campo vacio (departamento) | PASA |
| CP-06 | Fecha en fin de semana | PASA |
| CP-07 | Fecha en el pasado | PASA |
| CP-08 | Motivo sin letras | PASA |
| CP-09 | Visita duplicada (409) | PASA |
| CP-10 | Sesion vencida (401) | PASA |
| CP-11 | Error generico del servidor (500) | PASA |
| CP-12 | Formato de folio | PASA |

**Tests unitarios existentes:** 5 tests en `VisitasService.test.ts` cubren los escenarios de servicio (folio, departamentos, agendar, duplicado 409, sesion 401).

**Validaciones cubiertas en `validateVisitaForm()`:** departamento vacio, fecha vacia/formato/pasado/fin de semana, hora vacia/formato, motivo vacio/sin letras.

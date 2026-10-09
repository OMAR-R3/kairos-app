/**
 * Validador de formulario de login para Kairos Visitas.
 * Función de lógica pura: no depende de React ni de llamadas a la API,
 * solo recibe datos y regresa un resultado de validación.
 */

export type LoginFormValues = {
  email: string;
  password: string;
};

export type LoginFormErrors = {
  email?: string;
  password?: string;
};

export type LoginValidationResult = {
  valid: boolean;
  errors: LoginFormErrors;
};

const MIN_PASSWORD_LENGTH = 8;

export function validateLoginForm(values: LoginFormValues): LoginValidationResult {
  const errors: LoginFormErrors = {};

  const email = values.email?.trim() ?? "";
  const password = values.password ?? "";

  if (email.length === 0) {
    errors.email = "El correo es obligatorio.";
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = "El correo no tiene un formato válido.";
  }

  if (password.length === 0) {
    errors.password = "La contraseña es obligatoria.";
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// ---------- Registro de visitante (Crear cuenta) ----------

export type RegistroForm = {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  correo: string;
  telefono: string;
  password: string;
  confirmarPassword: string;
};

export type RegistroErrors = Partial<Record<keyof RegistroForm, string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegistroForm(form: RegistroForm) {
  const errors: RegistroErrors = {};

  const nombre = form.nombre.trim();
  const apellidoPaterno = form.apellidoPaterno.trim();
  const apellidoMaterno = form.apellidoMaterno.trim();
  const correo = form.correo.trim().toLowerCase();
  const telefono = form.telefono.replace(/\D/g, ""); // solo digitos

  if (!nombre) errors.nombre = "Escribe tu nombre";
  if (!apellidoPaterno) errors.apellidoPaterno = "Escribe tu apellido paterno";

  if (!correo) errors.correo = "Escribe tu correo";
  else if (!EMAIL_REGEX.test(correo)) errors.correo = "El correo no es valido";

  // Quitar este bloque si el backend deja el telefono como opcional
  if (!telefono) errors.telefono = "Escribe tu telefono";
  else if (telefono.length !== 10) errors.telefono = "Debe tener 10 digitos";

  if (!form.password) errors.password = "Escribe una contrasena";
  else if (form.password.length < 8)
    errors.password = "Minimo 8 caracteres";

  if (!form.confirmarPassword) errors.confirmarPassword = "Confirma tu contrasena";
  else if (form.password !== form.confirmarPassword)
    errors.confirmarPassword = "Las contrasenas no coinciden";

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    // Datos ya normalizados, listos para mandar al backend
    values: {
      nombre,
      apellido_paterno: apellidoPaterno,
      apellido_materno: apellidoMaterno || null,
      correo,
      telefono,
      password: form.password,
    },
  };
}

// ---------- Agendar visita (HU-02) ----------

export type VisitaForm = {
  motivo: string;
  area: string;
  fecha: string;
};

export type VisitaErrors = Partial<Record<keyof VisitaForm, string>>;

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function validateVisitaForm(form: VisitaForm) {
  const errors: VisitaErrors = {};

  const motivo = form.motivo.trim();
  const area = form.area.trim();

  if (!motivo) {
    errors.motivo = "El motivo es obligatorio";
  } else if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(motivo)) {
    errors.motivo = "El motivo debe contener letras";
  }

  if (!area) {
    errors.area = "El area es obligatoria";
  } else if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(area)) {
    errors.area = "El area debe contener letras";
  }

  if (!form.fecha) {
    errors.fecha = "La fecha es obligatoria";
  } else if (!FECHA_REGEX.test(form.fecha)) {
    errors.fecha = "Formato invalido (AAAA-MM-DD)";
  } else {
    const date = new Date(form.fecha + "T00:00:00");
    if (isNaN(date.getTime())) {
      errors.fecha = "Fecha no valida";
    } else if (date < new Date(new Date().toDateString())) {
      errors.fecha = "La fecha no puede ser en el pasado";
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
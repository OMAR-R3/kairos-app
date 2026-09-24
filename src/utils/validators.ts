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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

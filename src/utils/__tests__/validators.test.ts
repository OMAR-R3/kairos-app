import { validateLoginForm } from "../validators";

describe("validateLoginForm", () => {
  it("es válido cuando el correo y la contraseña cumplen el formato esperado", () => {
    const result = validateLoginForm({
      email: "visitante@example.com",
      password: "contrasena123",
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("marca error cuando el correo está vacío", () => {
    const result = validateLoginForm({ email: "", password: "contrasena123" });

    expect(result.valid).toBe(false);
    expect(result.errors.email).toBe("El correo es obligatorio.");
  });

  it("marca error cuando el correo no tiene formato válido", () => {
    const result = validateLoginForm({
      email: "correo-invalido",
      password: "contrasena123",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.email).toBe("El correo no tiene un formato válido.");
  });

  it("marca error cuando la contraseña está vacía", () => {
    const result = validateLoginForm({
      email: "visitante@example.com",
      password: "",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.password).toBe("La contraseña es obligatoria.");
  });

  it("marca error cuando la contraseña es demasiado corta", () => {
    const result = validateLoginForm({
      email: "visitante@example.com",
      password: "123",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.password).toBe(
      "La contraseña debe tener al menos 8 caracteres."
    );
  });

  it("recorta espacios en blanco del correo antes de validar", () => {
    const result = validateLoginForm({
      email: "  visitante@example.com  ",
      password: "contrasena123",
    });

    expect(result.valid).toBe(true);
  });
});

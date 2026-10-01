import { validateLoginForm, validateRegistroForm } from "../validators";

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

describe("validateRegistroForm", () => {
  const base = {
    nombre: "Ana",
    apellidoPaterno: "Lopez",
    apellidoMaterno: "",
    correo: "  ANA@Correo.com ",
    telefono: "442 123 4567",
    password: "abcd1234",
    confirmarPassword: "abcd1234",
  };

  it("acepta un formulario valido y normaliza los datos", () => {
    const r = validateRegistroForm(base);
    expect(r.valid).toBe(true);
    expect(r.values.correo).toBe("ana@correo.com");
    expect(r.values.telefono).toBe("4421234567");
    expect(r.values.apellido_materno).toBeNull();
  });

  it("marca los campos obligatorios vacios", () => {
    const r = validateRegistroForm({
      ...base, nombre: "", apellidoPaterno: "", correo: "", telefono: "",
    });
    expect(r.valid).toBe(false);
    expect(Object.keys(r.errors)).toEqual(
      expect.arrayContaining(["nombre", "apellidoPaterno", "correo", "telefono"])
    );
  });

  it("rechaza correo con formato invalido", () => {
    expect(validateRegistroForm({ ...base, correo: "ana@" }).errors.correo).toBeDefined();
  });

  it("rechaza telefono que no tiene 10 digitos", () => {
    expect(validateRegistroForm({ ...base, telefono: "12345" }).errors.telefono).toBeDefined();
  });

  it("rechaza contrasena corta", () => {
    const r = validateRegistroForm({ ...base, password: "abc", confirmarPassword: "abc" });
    expect(r.errors.password).toBeDefined();
  });

  it("rechaza contrasenas que no coinciden", () => {
    const r = validateRegistroForm({ ...base, confirmarPassword: "otra12345" });
    expect(r.errors.confirmarPassword).toBeDefined();
  });
});
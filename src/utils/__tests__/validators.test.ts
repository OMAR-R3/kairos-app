import {
  validateLoginForm,
  validateRegistroForm,
  validateVisitaForm,
} from "../validators";

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
      "La contraseña debe tener al menos 8 caracteres.",
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
      ...base,
      nombre: "",
      apellidoPaterno: "",
      correo: "",
      telefono: "",
    });
    expect(r.valid).toBe(false);
    expect(Object.keys(r.errors)).toEqual(
      expect.arrayContaining([
        "nombre",
        "apellidoPaterno",
        "correo",
        "telefono",
      ]),
    );
  });

  it("rechaza correo con formato invalido", () => {
    expect(
      validateRegistroForm({ ...base, correo: "ana@" }).errors.correo,
    ).toBeDefined();
  });

  it("rechaza telefono que no tiene 10 digitos", () => {
    expect(
      validateRegistroForm({ ...base, telefono: "12345" }).errors.telefono,
    ).toBeDefined();
  });

  it("rechaza contrasena corta", () => {
    const r = validateRegistroForm({
      ...base,
      password: "abc",
      confirmarPassword: "abc",
    });
    expect(r.errors.password).toBeDefined();
  });

  it("rechaza contrasenas que no coinciden", () => {
    const r = validateRegistroForm({ ...base, confirmarPassword: "otra12345" });
    expect(r.errors.confirmarPassword).toBeDefined();
  });
});

describe("validateVisitaForm", () => {
  // La validación usa la fecha actual, así que se fija un "hoy" conocido:
  // miércoles 14/10/2026.
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-14T12:00:00"));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  const base = {
    departamento: "3",
    fecha: "2026-10-15", // jueves
    horaLlegada: "10:00",
    motivo: "Entrevista",
  };

  it("acepta un formulario completo y correcto", () => {
    const r = validateVisitaForm(base);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual({});
  });

  it("marca error cuando no se selecciona departamento", () => {
    const r = validateVisitaForm({ ...base, departamento: "" });
    expect(r.valid).toBe(false);
    expect(r.errors.departamento).toBe("Selecciona un departamento");
  });

  it("marca error cuando la fecha está vacía", () => {
    const r = validateVisitaForm({ ...base, fecha: "" });
    expect(r.valid).toBe(false);
    expect(r.errors.fecha).toBe("La fecha es obligatoria");
  });

  it("rechaza una fecha con formato inválido", () => {
    const r = validateVisitaForm({ ...base, fecha: "15/10/2026" });
    expect(r.errors.fecha).toBe("Formato invalido (AAAA-MM-DD)");
  });

  it("rechaza una fecha que no existe", () => {
    const r = validateVisitaForm({ ...base, fecha: "2026-13-45" });
    expect(r.errors.fecha).toBe("Fecha no valida");
  });

  it("rechaza una fecha en el pasado", () => {
    const r = validateVisitaForm({ ...base, fecha: "2026-10-13" });
    expect(r.errors.fecha).toBe("La fecha no puede ser en el pasado");
  });

  it("acepta la fecha de hoy", () => {
    const r = validateVisitaForm({ ...base, fecha: "2026-10-14" });
    expect(r.errors.fecha).toBeUndefined();
  });

  it("rechaza sábado y domingo", () => {
    const sabado = validateVisitaForm({ ...base, fecha: "2026-10-17" });
    const domingo = validateVisitaForm({ ...base, fecha: "2026-10-18" });
    expect(sabado.errors.fecha).toBe(
      "Solo se permiten dias de lunes a viernes",
    );
    expect(domingo.errors.fecha).toBe(
      "Solo se permiten dias de lunes a viernes",
    );
  });

  it("marca error cuando la hora está vacía", () => {
    const r = validateVisitaForm({ ...base, horaLlegada: "" });
    expect(r.errors.horaLlegada).toBe("La hora es obligatoria");
  });

  it("rechaza una hora con formato inválido", () => {
    const r = validateVisitaForm({ ...base, horaLlegada: "9:5" });
    expect(r.errors.horaLlegada).toBe("Formato invalido (HH:MM)");
  });

  it("marca error cuando el motivo está vacío o solo tiene espacios", () => {
    const vacio = validateVisitaForm({ ...base, motivo: "" });
    const espacios = validateVisitaForm({ ...base, motivo: "   " });
    expect(vacio.errors.motivo).toBe("El motivo es obligatorio");
    expect(espacios.errors.motivo).toBe("El motivo es obligatorio");
  });

  it("rechaza un motivo que no contiene letras", () => {
    const r = validateVisitaForm({ ...base, motivo: "12345" });
    expect(r.errors.motivo).toBe("El motivo debe contener letras");
  });

  it("marca los cuatro campos cuando el formulario está vacío", () => {
    const r = validateVisitaForm({
      departamento: "",
      fecha: "",
      horaLlegada: "",
      motivo: "",
    });
    expect(r.valid).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(
      ["departamento", "fecha", "horaLlegada", "motivo"].sort(),
    );
  });
});

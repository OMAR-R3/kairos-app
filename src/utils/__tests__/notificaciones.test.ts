import { resolverAccion } from "@/hooks/useNotificationNavigation";

describe("resolverAccion", () => {
  it("navega al detalle cuando hay visita_id y sesión activa", () => {
    expect(resolverAccion({ visita_id: 42 }, true)).toEqual({
      tipo: "navegar",
      visitaId: "42",
    });
  });

  it("acepta visita_id como string", () => {
    expect(resolverAccion({ visita_id: "7" }, true)).toEqual({
      tipo: "navegar",
      visitaId: "7",
    });
  });

  it("devuelve sesion-expirada cuando la sesión no está activa", () => {
    expect(resolverAccion({ visita_id: 42 }, false)).toEqual({
      tipo: "sesion-expirada",
    });
  });

  it("ignora cuando no hay data", () => {
    expect(resolverAccion(undefined, true)).toEqual({ tipo: "ignorar" });
  });

  it("ignora cuando visita_id está vacío", () => {
    expect(resolverAccion({ visita_id: "" }, true)).toEqual({ tipo: "ignorar" });
  });

  it("ignora cuando visita_id no es un número válido", () => {
    expect(resolverAccion({ visita_id: "abc" }, true)).toEqual({ tipo: "ignorar" });
  });

  it("ignora cuando visita_id es 0", () => {
    expect(resolverAccion({ visita_id: 0 }, true)).toEqual({ tipo: "ignorar" });
  });

  it("ignora cuando visita_id es negativo", () => {
    expect(resolverAccion({ visita_id: "-5" }, true)).toEqual({ tipo: "ignorar" });
  });

  it("ignora cuando no viene visita_id en data", () => {
    expect(resolverAccion({ otro: "campo" }, true)).toEqual({ tipo: "ignorar" });
  });
});

# Guía de Contribución

Este documento describe el flujo de trabajo, la convención de commits y la política de versionado para el proyecto Kairos Visitas (app móvil).

## Flujo de trabajo

El proyecto sigue un esquema de ramificación ligero basado en Gitflow, adaptado al tamaño del equipo:

- **main**: rama estable y protegida. Solo recibe cambios mediante Pull Request, con al menos 1 aprobación y el CI en verde. Representa el código listo para distribución (EAS Build/Submit).
- **develop**: rama de integración. Aquí se combinan las funcionalidades terminadas antes de pasar a `main`.
- **feature/nombre-descriptivo**: una rama por historia de usuario o funcionalidad, creada desde `develop`. Ejemplo: `feature/login-visitante`.
- **hotfix/nombre-descriptivo**: para correcciones urgentes sobre `main`. Se integra directo a `main` y se etiqueta con la nueva versión.

### Pasos para contribuir

1. Crear una rama a partir de `develop` (o de `main` en el caso de un `hotfix/*`) con el formato `feature/nombre-modulo` o `hotfix/descripcion`.
2. Realizar commits siguiendo la convención descrita abajo.
3. Abrir un Pull Request hacia `develop` (o hacia `main` si es un `hotfix/*`).
4. El PR requiere que el CI pase en verde y al menos 1 aprobación antes de poder fusionarse.
5. Al cerrar un sprint, se abre un Pull Request de `develop` hacia `main` para liberar la versión.

## Convención de commits

Se usa el estándar **Conventional Commits**. Cada mensaje lleva el formato:

```
tipo: descripción corta de lo que se hizo
```

El tipo (prefijo) indica qué clase de cambio es, y facilita leer el historial y, más adelante, generar un changelog automático.

| Prefijo | Cuándo se usa | Ejemplo |
|---|---|---|
| `feat` | Se agrega una funcionalidad nueva | `feat: agregar validador de formulario de login` |
| `fix` | Se corrige un bug | `fix: corregir expiración de token JWT` |
| `docs` | Cambios solo de documentación (README, CONTRIBUTING, capturas) | `docs: actualizar README con instrucciones de build` |
| `chore` | Mantenimiento y configuración que no cambia el código de la app (ESLint, Jest, .gitignore, CI, dependencias) | `chore: configurar ESLint` |
| `refactor` | Se reorganiza el código sin cambiar lo que hace | `refactor: extraer lógica de validación a módulo separado` |
| `test` | Se agregan o ajustan pruebas | `test: agregar prueba unitaria para validador de login` |

Reglas básicas:

- La descripción va en minúsculas y en infinitivo, sin punto final.
- Un commit por cambio lógico; evitar mezclar, por ejemplo, una funcionalidad nueva con un ajuste de configuración.

## Versionado

El proyecto usa versionado semántico enlazado al número de compilación:

```
vMayor.Menor.Parche (build N)
```

- **Mayor**: cambios que rompen compatibilidad o rediseños importantes de flujo.
- **Menor**: nuevas funcionalidades compatibles con versiones anteriores.
- **Parche**: correcciones de bugs sin cambios de funcionalidad.
- **build N**: número de compilación interno, incrementado en cada build generado con EAS (corresponde a `versionCode` en Android y `buildNumber` en iOS, configurados en `app.json`).

Un tag se crea en `main` únicamente después de que una versión fue distribuida vía EAS y verificada con la prueba manual de humo. Ejemplo: `v0.1.0 (build 3)`.

## Pull Requests

Todo PR debe usar la plantilla del repositorio (`.github/pull_request_template.md`) y cumplir:

- El código pasa el lint (`npx expo lint`) sin errores.
- Las pruebas unitarias pasan (`npm test`).
- Al menos 1 revisor aprobó los cambios.
- El PR apunta a la rama correcta (`develop` para features, `main` solo para `hotfix/*` o cierre de sprint).

## Reporte de bugs y funcionalidades

Los issues se abren usando las plantillas disponibles en `.github/ISSUE_TEMPLATE/`: reporte de bug o historia de usuario/funcionalidad nueva.

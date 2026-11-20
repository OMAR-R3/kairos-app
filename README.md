# Kairos Visitas

Extensión móvil del sistema Kairos: permite a visitantes recurrentes de la Universidad Tecnológica de San Juan del Río registrar una visita y acceder a un código QR sin repetir el flujo completo de registro de la extranet web.

App nativa construida con [Expo](https://expo.dev) y React Native, creada originalmente con [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

![CI](https://github.com/OMAR-R3/kairos-app/actions/workflows/ci.yml/badge.svg)

## Documentación del proyecto

- Plan DevOps del Proyecto Móvil (entregado aparte, fuera del repositorio)
- Documento técnico: CI y estrategia de despliegue (entregado aparte, fuera del repositorio)
- [Guía de contribución](CONTRIBUTING.md)
- Board del proyecto: gestionado en ClickUp (Sprint 0 y backlog)

## Evidencias de configuración

- [Regla de protección de la rama main](docs/evidencias/Regla%20de%20protecci%C3%B3n%20de%20main%20activa%20y%20completa.jpg)
- [Checks de CI en verde](docs/evidencias/Checks%20de%20CI%20en%20verde.jpg)
- [Estado de un Pull Request real](docs/evidencias/Estado%20de%20un%20Pull%20Request%20real.jpg)

## Flujo de trabajo

El proyecto sigue Gitflow simplificado (`main`, `develop`, `feature/*`, `hotfix/*`). Ver [CONTRIBUTING.md](CONTRIBUTING.md) para el detalle de ramas, convención de commits y versionado.

La rama `main` está protegida: todo cambio requiere Pull Request, al menos 1 aprobación, y que el pipeline de CI (lint + pruebas unitarias) pase en verde.

## Get started

1. Install dependencies for the proyect

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Build de desarrollo (development build)

La app **no corre en Expo Go**: desde el SDK 53 Expo Go no soporta notificaciones push remotas y el proyecto usa módulos nativos (`expo-notifications`, `expo-secure-store`, `react-native-svg`, entre otros). Por eso se usa un *development build* con [`expo-dev-client`](https://docs.expo.dev/develop/development-builds/introduction/), que ya está en `package.json` y `package-lock.json`.

### Generar el build (Android)

1. Instalar dependencias con la versión bloqueada: `npm ci`.
2. Iniciar sesión en Expo con una cuenta del equipo (proyecto `r3mat3rs-team`):

   ```bash
   npx eas-cli login
   ```

3. Generar el build con el perfil `development` de `eas.json` (`developmentClient: true`, distribución interna):

   ```bash
   npx eas-cli build --profile development --platform android
   ```

4. Al terminar, EAS entrega un enlace y un código QR para descargar e instalar el APK en el celular.

### Usarlo en el día a día

1. Copiar `.env.example` a `.env` y poner la URL de la API en `EXPO_PUBLIC_API_URL`.
2. Iniciar Metro en modo *dev client* (no usar las opciones `w` ni `s`):

   ```bash
   npx expo start --dev-client
   ```

3. Abrir la app instalada en el celular y escanear el QR de la terminal. Los cambios en código JS/TS se ven al instante, sin generar otro build.

### Cuándo hay que regenerarlo

Solo cuando cambia la parte nativa de la app:

- Se agrega, quita o actualiza un paquete con código nativo (`expo-*`, `react-native-*`).
- Cambia `app.json` en algo nativo: `plugins`, permisos, `package`, ícono o splash, `google-services.json`.
- Se actualiza la versión del SDK de Expo.

**No** hace falta para cambios de pantallas, lógica, estilos, pruebas ni del archivo `.env` (en ese caso basta reiniciar Metro con `npx expo start --dev-client -c`).

Después de regenerarlo hay que instalar el APK nuevo. Si se cambian dependencias, `package.json` y `package-lock.json` se suben juntos en el mismo commit, porque EAS instala con `npm ci` y falla si no están sincronizados.

## Pruebas y linter

```bash
npm test
```

```bash
npx expo lint
```

Ambos comandos corren automáticamente en el pipeline de CI en cada Pull Request hacia `main`.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
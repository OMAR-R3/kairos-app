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

1. Install dependencies

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
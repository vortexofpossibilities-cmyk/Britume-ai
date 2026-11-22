# BRITUME AI — GitHub Pages deployment repair pack

## What's included

- `.github/workflows/deploy.yml` — a GitHub Actions workflow that installs the web dependencies, exports the Expo app as a static website into `dist`, uploads that folder, and deploys it to GitHub Pages.

## What the dependencies do

- `react-native-web`: lets React Native UI components render in a web browser.
- `react-dom`: React's browser renderer; required for web output.
- `expo-asset`: Expo's asset handling for images, fonts, and other bundled assets.
- `expo-font`: Expo's font loading support; Expo Router's static renderer imports it.
- `query-string`: parses and serializes URL query strings; the installed Expo Router build imports it.

The workflow uses `npx expo install` for Expo-compatible package versions. `query-string` is installed with npm because it is a regular JavaScript dependency.

## How to use it

1. Download and unzip this archive.
2. In your BRITUME AI GitHub repository, open `.github/workflows/deploy.yml`.
3. Replace that file's entire contents with the included `deploy.yml`.
4. Commit the change to the `main` branch.
5. Open the repository's **Actions** tab and inspect the latest run. Both `build` and `deploy` must succeed.
6. In **Settings → Pages**, make sure the publishing source is **GitHub Actions**.

## Important limits

This is a deployment repair pack, not a complete copy of the BRITUME AI app or repository. It contains the workflow file and this guide only. I cannot include or repair your private repository's `app/`, `backend/`, `package.json`, or other source files unless you upload them here.

This workflow addresses the missing packages shown in the build logs so far. It does not guarantee the app will build: the next error may reveal another missing dependency or an application/configuration problem. A successful GitHub Pages deployment hosts only the static web frontend; it does not host the Node.js backend. The backend and its secrets need separate secure hosting.

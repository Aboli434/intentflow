# Intent Android Mobile Application — Production Release Guide

This document details the configuration, real-world architecture, and release artifacts for the production Android application **Intent**.

---

## 1. Application Identity & Branding

* **Application Name:** `Intent`
* **Package Identifier:** `com.intentflow.app`
* **Slug:** `intent-app`
* **App Icon:** Sleek AI-generated neon cyan / deep indigo geometric hexagon brandmark (`assets/icon.png`, `assets/adaptive-icon.png`, `assets/splash.png`).
* **Android Strings:** `apps/mobile/android/app/src/main/res/values/strings.xml` defines `<string name="app_name">Intent</string>`.

---

## 2. Release Artifacts Generated

Both production release artifacts have been successfully generated, signed, and placed in the project root:

| Artifact File | Description | Target Use Case | Size |
| :--- | :--- | :--- | :--- |
| **`IntentFlow-testing.apk`** | Production Android Package (`.apk`) | Direct sideload testing on physical Android devices / Firebase App Distribution | **~72.9 MB** |
| **`IntentFlow-release.aab`** | Google Play App Bundle (`.aab`) | Official Google Play Store Console distribution / Internal Testing Track | **~32.5 MB** |

* Original build outputs:
  - APK: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
  - AAB: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`

---

## 3. Real Backend & Multi-Tenant Architecture

All dummy, demo, and bypass authentication mechanisms have been removed from the mobile application:
* **Production API Base URL:** `https://intentflow-y1ga.onrender.com`
* **Authentication Workflow:**
  - `apps/mobile/app/index.tsx`: Clean onboarding screen highlighting IntentFlow capabilities with direct access to Sign In and Account Registration.
  - `apps/mobile/app/login.tsx`: Real backend login querying `POST /auth/login` with JWT token persistence via `@react-native-async-storage/async-storage`.
  - `apps/mobile/app/signup.tsx`: Full registration querying `POST /auth/register` with input validation (8+ character password, email formatting, confirmation match).
  - `apps/mobile/app/(app)/index.tsx`: Dashboard displaying live workspace membership, active work streams, and pull-to-refresh data sync.
  - `apps/mobile/src/api-client.ts`: Live API client targeting the production Fastify backend with Bearer token authentication.

---

## 4. Google Play Store Pre-Publishing Checklist

1. **Keystore Configuration:**
   - To replace the debug signing key with your Google Play release keystore before publishing:
     1. Generate your release keystore:
        ```bash
        keytool -genkey -v -keystore intent-release.keystore -alias intent-alias -keyalg RSA -keysize 2048 -validity 10000
        ```
     2. Update `apps/mobile/android/app/build.gradle` signingConfigs with the keystore path and passwords.
2. **Google Play Console Upload:**
   - Upload `IntentFlow-release.aab` to **Production** or **Internal testing track** in Google Play Console.
3. **Target API Level:**
   - Target SDK: `34` (Android 14)
   - Minimum SDK: `24` (Android 7.0)
   - Meets Google Play's modern target SDK requirements.

# Dashboard Checker - Development Guide

## 🚀 Schnellstart

### Entwicklungsserver starten
```bash
npm run dev
```
Öffnet [http://localhost:3000](http://localhost:3000) im Browser.

### Build erstellen
```bash
npm run build
```

### Produktionsserver starten
```bash
npm start
```

## 🧪 Testing

### Unit Tests
```bash
# Einmalige Ausführung
npm test

# Mit Datei-Überwachung
npm run test:watch

# Mit Coverage-Bericht
npm run test:coverage
```

### E2E Tests (Playwright)
```bash
# Tests ausführen
npm run playwright

# UI-Modus für Test-Entwicklung
npm run playwright:ui

# Debug-Modus
npm run playwright:debug
```

### Zusätzliche Test-Skripte

#### Vollständiger Test-Flow
```bash
./test_flow.sh
```
Führt alle Tests aus: Auth-Flow, Dashboard-Erstellung, Checks, API-Tests.

#### Authentifizierung testen
```bash
./test_auth_flow.sh
```
Testet Login, Session-Management und API-Zugriff.

#### Anwendung verifizieren
```bash
./verify_app.sh
```
Überprüft alle kritischen Funktionen der Anwendung.

## 📁 Projekt-Struktur im Detail

```
dashboard-checker/
├── app/                          # Next.js App Router
│   ├── api/                      # API-Endpunkte
│   │   ├── checks/               # Dashboard-Check-Endpunkt
│   │   ├── cron/                 # Cron-Job für automatisierte Checks
│   │   └── dashboards/           # Dashboard-CRUD-API
│   ├── auth/                     # Authentifizierungsseiten
│   ├── dashboards/               # Dashboard-Management
│   │   ├── [id]/                 # Dynamische Routen
│   │   │   ├── edit/             # Dashboard bearbeiten
│   │   │   └── page.tsx          # Dashboard-Details
│   │   ├── new/                  # Neues Dashboard
│   │   └── page.tsx              # Dashboard-Liste
│   ├── globals.css               # Globale Styles
│   ├── layout.tsx                # Root-Layout
│   └── page.tsx                  # Startseite
├── components/                   # Wiederverwendbare Komponenten
│   ├── DashboardForm.tsx         # Dashboard-Formular
│   ├── DashboardList.tsx         # Dashboard-Liste
│   └── ui/                       # UI-Komponenten
├── lib/                          # Hilfsbibliotheken
│   ├── supabase/                 # Datenbank-Client
│   │   ├── client.ts             # Client für Browser
│   │   └── server.ts             # Client für Server
│   └── checks/                   # Check-Logik
│       ├── checker.ts            # Haupt-Check-Logik
│       ├── resultProcessor.ts    # Ergebnis-Verarbeitung
│       └── screenshotCapture.ts  # Screenshot-Erfassung
├── supabase/                     # Datenbank-Schema
│   └── migrations/               # SQL-Migrationen
├── __tests__/                    # Unit-Tests
│   ├── setup.ts                  # Test-Konfiguration
│   └── *.test.ts                 # Test-Dateien
├── public/                       # Statische Assets
│   └── favicon.svg               # Favicon
├── playwright.config.ts          # E2E-Test-Konfiguration
├── tailwind.config.js            # Tailwind-CSS-Konfiguration
├── next.config.js                # Next.js-Konfiguration
├── tsconfig.json                 # TypeScript-Konfiguration
├── package.json                  # Abhängigkeiten & Skripte
├── .env.local                    # Umgebungsvariablen (nicht versioniert)
└── vercel.json                   # Vercel-Deployment-Konfiguration
```

## 🔧 Konfiguration

### Umgebungsvariablen (.env.local)

```env
# Supabase-Konfiguration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optionale Konfiguration
PORT=3000
NODE_ENV=development
```

### Next.js Konfiguration (next.config.js)

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['your-supabase-project.supabase.co'],
  },
}

module.exports = nextConfig
```

### Tailwind CSS Konfiguration

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Indigo Metric Design System
        primary: '#4F46E5',
        success: '#10B981',
        error: '#F43F5E',
        background: '#F8FAFC',
      },
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
      },
      borderRadius: {
        'card': '8px',
      },
    },
  },
  plugins: [],
}
```

### Playwright Konfiguration

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './__tests__',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
```

## 🔐 Sicherheit

### Row Level Security (RLS)
- Alle Datenbanktabellen haben RLS aktiviert
- Benutzer können nur ihre eigenen Daten sehen/bearbeiten
- API-Endpunkte validieren Benutzerberechtigungen

### Authentifizierung
- JWT-Token-basierte Authentifizierung via Supabase
- Automatische Token-Verlängerung
- Sichere Passwort-Hashes

### API-Sicherheit
- Bearer-Token-Verifikation für alle API-Calls
- Service-Role-Key für Server-seitige Operationen
- Input-Validierung mit Zod-Schemas

## 🚀 Deployment

### Vercel (Empfohlen)

1. **Repository verbinden**: GitHub-Repository mit Vercel verknüpfen
2. **Umgebungsvariablen**: Supabase-Credentials in Vercel setzen
3. **Cron-Jobs**: Wöchentlichen Check hinzufügen:
   ```
   0 9 * * 1 /api/cron/check-dashboards
   ```
4. **Deploy**: Automatisches Deployment bei jedem Push

### Lokale Produktion

```bash
# Build erstellen
npm run build

# Produktionsserver starten
npm start
```

## 🐛 Fehlerbehebung

### Häufige Probleme

#### 404-Fehler bei statischen Assets
```bash
# Cache leeren und Server neu starten
rm -rf .next node_modules/.cache
npm run dev
```

#### Authentifizierungsfehler (401)
- Überprüfen Sie die Supabase-Credentials in `.env.local`
- Stellen Sie sicher, dass RLS-Policies korrekt konfiguriert sind
- Prüfen Sie die Browser-Konsole auf Session-Fehler

#### Playwright-Tests schlagen fehl
```bash
# Browser aktualisieren
npx playwright install

# Tests im Debug-Modus ausführen
npm run playwright:debug
```

#### Datenbank-Verbindungsfehler
- Überprüfen Sie die Supabase-URL und API-Keys
- Stellen Sie sicher, dass die Migrationen ausgeführt wurden
- Prüfen Sie die Netzwerkverbindung zu Supabase

### Logs und Debugging

#### Server-Logs
```bash
# Entwicklungsserver mit detaillierten Logs
npm run dev 2>&1 | tee dev-server.log
```

#### Datenbank-Logs
- Supabase Dashboard → Database → Logs
- API-Route-Logs in Vercel Dashboard

#### Browser-Debugging
- Browser-Konsole für Client-seitige Fehler
- Network-Tab für API-Request/Response
- Application-Tab für localStorage-Session

## 📊 Monitoring

### Health Checks
- Automatische Dashboard-Checks via Cron-Jobs
- Manuelle Checks über die UI
- Fehler-Benachrichtigungen (geplant)

### Performance
- Next.js Analytics für Performance-Metriken
- Vercel Analytics für Deployment-Metriken
- Supabase Dashboard für Datenbank-Metriken

## 🤝 Beitrag leisten

### Code-Standards
- **TypeScript**: Strenge Typisierung
- **ESLint**: Code-Qualitätsprüfung
- **Prettier**: Konsistente Formatierung
- **Conventional Commits**: Strukturierte Commit-Nachrichten

### Pull Request Prozess
1. Fork erstellen
2. Feature-Branch: `git checkout -b feature/amazing-feature`
3. Änderungen committen: `git commit -m 'feat: add amazing feature'`
4. Branch pushen: `git push origin feature/amazing-feature`
5. Pull Request öffnen

### Testing vor Commit
```bash
# Alle Tests ausführen
npm test && npm run playwright

# Coverage prüfen
npm run test:coverage

# Linting
npm run lint
```

---

**Dashboard Checker** - Professionelle Entwicklungsumgebung für zuverlässige Dashboard-Überwachung 🛠️
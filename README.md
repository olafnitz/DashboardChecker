# Dashboard Checker

[![Next.js](https://img.shields.io/badge/Next.js-14.2.35-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0.0-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.0-38B2AC)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-2.39.0-3ECF8E)](https://supabase.com/)
[![Playwright](https://img.shields.io/badge/Playwright-1.40.0-2EAD33)](https://playwright.dev/)

Eine moderne Webanwendung zur automatischen Überwachung von Google Looker Studio Dashboards. Das System führt tägliche Health-Checks durch, erkennt automatisch alle Dashboard-Seiten und liefert detaillierte Statusberichte mit Screenshots bei Fehlern.

## ✨ Features

### 🔍 Dashboard-Management
- **Einfache Verwaltung**: Hinzufügen, Bearbeiten und Löschen von Dashboard-URLs
- **Automatische Seitenerkennung**: Erkennt automatisch alle Seiten/Tabs in Looker Studio Dashboards
- **Benutzerbasierte Organisation**: Jeder Benutzer verwaltet seine eigenen Dashboards

### 🤖 Automatisierte Überwachung
- **Tägliche Health-Checks**: Automatische Überprüfung aller registrierten Dashboards
- **Playwright-Integration**: Headless Browser-Automation für zuverlässige Tests
- **Intelligente Navigation**: Erkennt verschiedene Looker Studio Navigationstypen (Menü, Sidebar, Tabs)

### 📊 Monitoring & Berichterstattung
- **Echtzeit-Status**: Grüne/Rote Indikatoren für Dashboard-Gesundheit
- **Detaillierte Historie**: Vollständige Check-Historie mit Zeitstempeln
- **Seiten-Level-Berichte**: Individuelle Statusberichte für jede Dashboard-Seite
- **Fehler-Screenshots**: Automatische Screenshots bei Fehlern zur Diagnose

### 🔐 Sicherheit & Authentifizierung
- **Supabase Auth**: Sichere Benutzerverwaltung mit JWT-Tokens
- **Row Level Security**: Datenbank-Level-Sicherheit für Multi-Tenant-Architektur
- **API-Schutz**: Bearer-Token-Authentifizierung für alle API-Endpunkte

### 🎨 Moderne Benutzeroberfläche
- **Indigo Metric Design System**: Konsistente Farbpalette und Komponenten
- **Responsive Design**: Optimiert für Desktop und Mobile
- **Manrope Font**: Moderne Typografie für bessere Lesbarkeit
- **Card-basierte Layouts**: Klare, strukturierte Benutzeroberfläche

## 🏗️ Architektur

### Technologie-Stack

| Komponente | Technologie | Version | Zweck |
|------------|-------------|---------|--------|
| **Frontend** | Next.js 14 (App Router) | 14.2.35 | React-Framework mit Server Components |
| **Backend** | Next.js API Routes | 14.2.35 | Serverless API-Endpunkte |
| **Datenbank** | Supabase (PostgreSQL) | 2.39.0 | Managed Database mit RLS |
| **Authentifizierung** | Supabase Auth | 2.39.0 | JWT-basierte Authentifizierung |
| **Browser-Automation** | Playwright | 1.40.0 | Headless Browser für Dashboard-Tests |
| **Styling** | Tailwind CSS | 3.4.0 | Utility-First CSS Framework |
| **TypeScript** | TypeScript | 5.0.0 | Typensichere Entwicklung |
| **Deployment** | Vercel | - | Serverless Deployment Platform |

### Systemarchitektur

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App   │    │   Supabase DB   │    │  Playwright     │
│                 │    │                 │    │  Automation     │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │                 │
│ │  Frontend   │◄┼────┼►│  Dashboards │ │    │ ┌─────────────┐ │
│ │  (React)    │ │    │ │  Table       │ │    │ │  Browser    │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ │  Engine     │ │
│                 │    │ ┌─────────────┐ │    │ └─────────────┘ │
│ ┌─────────────┐ │    │ │Check Results│ │    │                 │
│ │ API Routes  │◄┼────┼►│  Table       │ │    └─────────────────┘
│ │ (Serverless)│ │    │ └─────────────┘ │
│ └─────────────┘ │    │ ┌─────────────┐ │
│                 │    │ │Page Results │ │
│ ┌─────────────┐ │    │ │  Table       │ │
│ │ Cron Jobs   │◄┼────┼►│             │ │
│ │ (Vercel)    │ │    │ └─────────────┘ │
│ └─────────────┘ │    └─────────────────┘
└─────────────────┘
```

### Datenbank-Schema

#### `dashboards` Tabelle
```sql
CREATE TABLE dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `check_results` Tabelle
```sql
CREATE TABLE check_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  overall_status TEXT NOT NULL CHECK (overall_status IN ('ok', 'error'))
);
```

#### `page_results` Tabelle
```sql
CREATE TABLE page_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_result_id UUID NOT NULL REFERENCES check_results(id) ON DELETE CASCADE,
  page_name TEXT,
  page_number INTEGER,
  page_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  error_description TEXT,
  screenshot_url TEXT
);
```

## 🚀 Installation & Setup

### Voraussetzungen

- **Node.js**: Version 18.0 oder höher
- **npm**: Version 8.0 oder höher (wird mit Node.js installiert)
- **Supabase Account**: Für Datenbank und Authentifizierung
- **Git**: Für Repository-Management

### 1. Repository klonen

```bash
git clone <repository-url>
cd dashboard-checker
```

### 2. Abhängigkeiten installieren

```bash
npm install
```

### 3. Umgebungsvariablen konfigurieren

```bash
cp .env.local.example .env.local
```

Bearbeiten Sie `.env.local` mit Ihren Supabase-Credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: Custom Port for Development
PORT=3000
```

### 4. Supabase Datenbank einrichten

#### Option A: Supabase CLI (empfohlen)
```bash
# Supabase CLI installieren
npm install -g supabase

# Login bei Supabase
supabase login

# Projekt initialisieren
supabase init

# Migrationen anwenden
supabase db push
```

#### Option B: Manuell über Supabase Dashboard
1. Gehen Sie zu Ihrem Supabase Dashboard
2. Öffnen Sie den SQL Editor
3. Führen Sie die Migrationen aus `supabase/migrations/` aus

### 5. Entwicklungsserver starten

```bash
npm run dev
```

Öffnen Sie [http://localhost:3000](http://localhost:3000) in Ihrem Browser.

## � Dokumentation

### 📖 Vollständige Dokumentation
- **[README](README.md)**: Diese Datei - Überblick und Schnellstart
- **[Development Guide](DEVELOPMENT_GUIDE.md)**: Detaillierte Entwicklungsumgebung und Konfiguration
- **[Testing Guide](TESTING_GUIDE.md)**: Umfassende Test-Strategien und API-Dokumentation
- **[Implementation Complete](IMPLEMENTATION_COMPLETE.md)**: Status und abgeschlossene Features
- **[Fixes Applied](FIXES_APPLIED.md)**: Behobene Probleme und Lösungen

### 🔧 Schnellzugriff

### Dashboard hinzufügen

1. **Registrieren/Login**: Erstellen Sie ein Konto oder melden Sie sich an
2. **Dashboard hinzufügen**: Klicken Sie auf "Add New Dashboard"
3. **Details eingeben**:
   - **Name**: Beschreibender Name für das Dashboard
   - **URL**: Vollständige Looker Studio URL (z.B. `https://lookerstudio.google.com/reporting/...`)
4. **Speichern**: Das Dashboard wird automatisch überwacht

### Dashboard bearbeiten

1. Gehen Sie zur Dashboard-Detailseite
2. Klicken Sie auf "Edit Dashboard"
3. Ändern Sie Name oder URL
4. Speichern Sie die Änderungen

### Manuelle Checks

1. Öffnen Sie die Dashboard-Detailseite
2. Klicken Sie auf "Check Now"
3. Warten Sie auf die Fertigstellung
4. Überprüfen Sie die Ergebnisse in der Check-Historie

## 🔧 API-Dokumentation

### Authentifizierte Endpunkte

Alle API-Endpunkte erfordern einen gültigen Bearer-Token im `Authorization` Header:

```
Authorization: Bearer <jwt-token>
```

### Dashboard-Management

#### `GET /api/dashboards`
**Beschreibung**: Ruft alle Dashboards des authentifizierten Benutzers ab

**Response**:
```json
{
  "dashboards": [
    {
      "id": "uuid",
      "name": "Dashboard Name",
      "url": "https://lookerstudio.google.com/...",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### `POST /api/dashboards`
**Beschreibung**: Erstellt ein neues Dashboard

**Request Body**:
```json
{
  "name": "Dashboard Name",
  "url": "https://lookerstudio.google.com/reporting/..."
}
```

#### `GET /api/dashboards/[id]`
**Beschreibung**: Ruft ein spezifisches Dashboard ab

#### `PUT /api/dashboards/[id]`
**Beschreibung**: Aktualisiert ein Dashboard

#### `DELETE /api/dashboards/[id]`
**Beschreibung**: Löscht ein Dashboard

### Check-Management

#### `POST /api/checks`
**Beschreibung**: Führt einen manuellen Check für ein Dashboard aus

**Request Body**:
```json
{
  "dashboardId": "uuid"
}
```

#### `GET /api/cron/check-dashboards`
**Beschreibung**: Cron-Job-Endpunkt für automatisierte Checks (intern)

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### E2E Tests mit Playwright
```bash
# Tests ausführen
npm run playwright

# Tests im UI-Modus
npm run playwright:ui

# Tests debuggen
npm run playwright:debug
```

### Test-Skripte

Zusätzliche Test-Skripte sind im Root-Verzeichnis verfügbar:

- `test_flow.sh`: Vollständiger Test-Flow
- `test_auth_flow.sh`: Authentifizierungs-Tests
- `verify_app.sh`: Anwendungs-Verifikation

## 🚢 Deployment

### Vercel Deployment (empfohlen)

1. **Repository verbinden**: Verbinden Sie Ihr GitHub-Repository mit Vercel
2. **Umgebungsvariablen setzen**: Konfigurieren Sie die Supabase-Variablen in Vercel
3. **Cron Jobs einrichten**: Fügen Sie den wöchentlichen Cron Job hinzu:
   ```
   0 9 * * 1 /api/cron/check-dashboards
   ```
4. **Deploy**: Vercel übernimmt automatisch das Deployment bei jedem Push

### Manuelles Deployment

```bash
# Build erstellen
npm run build

# Produktionsserver starten
npm start
```

## 🔒 Sicherheit

### Row Level Security (RLS)
- Alle Datenbanktabellen haben RLS aktiviert
- Benutzer können nur ihre eigenen Daten sehen und bearbeiten
- API-Endpunkte validieren Benutzerberechtigungen

### Authentifizierung
- JWT-Token-basierte Authentifizierung
- Automatische Token-Verlängerung
- Sichere Passwort-Hashes durch Supabase

### Input-Validierung
- Client- und Server-seitige Validierung
- URL-Format-Validierung
- XSS-Schutz durch React

## 📁 Projekt-Struktur

```
dashboard-checker/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── cron/                 # Cron Jobs
│   │   ├── dashboards/           # Dashboard CRUD
│   │   └── checks/               # Check Endpoints
│   ├── auth/                     # Authentifizierung
│   ├── dashboards/               # Dashboard Pages
│   │   ├── [id]/                 # Dynamic Routes
│   │   │   ├── edit/             # Edit Page
│   │   │   └── page.tsx          # Detail Page
│   │   ├── new/                  # New Dashboard
│   │   └── page.tsx              # Dashboard List
│   ├── globals.css               # Global Styles
│   ├── layout.tsx                # Root Layout
│   └── page.tsx                  # Homepage
├── components/                   # Reusable Components
│   ├── DashboardForm.tsx         # Form Component
│   ├── DashboardList.tsx         # List Component
│   └── ui/                       # UI Components
├── lib/                          # Utility Libraries
│   ├── supabase/                 # Database Client
│   └── utils/                    # Helper Functions
├── supabase/                     # Database Schema
│   └── migrations/               # SQL Migrations
├── __tests__/                    # Unit Tests
├── public/                       # Static Assets
├── playwright.config.ts          # E2E Test Config
├── tailwind.config.js            # Tailwind Config
└── package.json                  # Dependencies
```

## 🤝 Beitrag leisten

### Entwicklungsumgebung einrichten

1. Forken Sie das Repository
2. Erstellen Sie einen Feature-Branch: `git checkout -b feature/amazing-feature`
3. Committen Sie Ihre Änderungen: `git commit -m 'Add amazing feature'`
4. Pushen Sie den Branch: `git push origin feature/amazing-feature`
5. Öffnen Sie einen Pull Request

### Code-Standards

- **TypeScript**: Strenge Typisierung für alle neuen Features
- **ESLint**: Automatische Code-Qualitätsprüfung
- **Prettier**: Konsistente Code-Formatierung
- **Conventional Commits**: Strukturierte Commit-Nachrichten

### Testing

- **Unit Tests**: Für alle neuen Funktionen
- **Integration Tests**: Für API-Endpunkte
- **E2E Tests**: Für kritische User Flows

## 📝 Changelog

### Version 1.0.0 (Aktuell)
- ✅ Vollständige Dashboard-Management-Funktionalität
- ✅ Automatisierte Health-Checks mit Playwright
- ✅ Supabase-Integration mit RLS
- ✅ Moderne UI mit Indigo Metric Design System
- ✅ Responsive Design für alle Geräte
- ✅ Umfassende Test-Suite

## 📄 Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert - siehe die [LICENSE](LICENSE) Datei für Details.

## 🙏 Danksagungen

- **Supabase Team**: Für die hervorragende Datenbank- und Authentifizierungsplattform
- **Vercel Team**: Für die zuverlässige Serverless-Infrastruktur
- **Playwright Team**: Für die robuste Browser-Automation
- **Next.js Team**: Für das moderne React-Framework

## 📞 Support

Bei Fragen oder Problemen:

1. **Dokumentation prüfen**: Lesen Sie diese README und die Testing-Guide
2. **Issues öffnen**: Verwenden Sie GitHub Issues für Bug-Reports
3. **Community**: Treten Sie unserer Community bei für Diskussionen

---

**Dashboard Checker** - Zuverlässige Überwachung Ihrer Google Looker Studio Dashboards 🚀
```

### Coverage Report
```bash
npm run test:coverage
```

## Deployment

### Vercel Deployment

1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard
3. Configure cron job in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/check-dashboards",
      "schedule": "0 6 * * *"
    }
  ]
}
```

### Supabase Setup

1. Create a new Supabase project
2. Run the migration files in the SQL editor
3. Set up authentication providers if needed
4. Create a storage bucket called "screenshots" for error screenshots

## How It Works

1. **Dashboard Registration**: Users add their Looker Studio dashboard URLs
2. **Automated Checks**: Daily cron job checks all dashboards using Playwright
3. **Page Detection**: Each dashboard's pages/tabs are automatically detected
4. **Health Checks**: Each page is checked for:
   - Successful loading
   - Absence of error messages
   - Presence of data widgets
5. **Result Storage**: Check results are stored with timestamps and error details
6. **Screenshot Capture**: Failed pages are screenshot for debugging
7. **Status Display**: Dashboard list shows current status with detailed history

## Security

- Row Level Security (RLS) ensures data isolation
- Input validation with Zod schemas
- Authentication required for all operations
- No hardcoded secrets in source code
- HTTPS enforced in production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

This project is licensed under the MIT License.
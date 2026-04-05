# Design System: Indigo Metric

## 1. Vision & Prinzipien
Der **DashboardChecker** folgt dem Leitbild der **"Präzisen Kuratierung"**. Das Design ist darauf ausgelegt, komplexe Monitoring-Daten in eine klare, handlungsorientierte Benutzeroberfläche zu übersetzen.

*   **Klarheit vor Dekoration:** Jedes visuelle Element hat einen funktionalen Zweck.
*   **Dringlichkeit durch Farbe:** Farben werden gezielt eingesetzt, um den Systemstatus (OK, Warnung, Fehler) sofort kommunizierbar zu machen.
*   **Informationsdichte:** Ein kompaktes Layout ermöglicht den Überblick über viele Datenpunkte, ohne den Nutzer zu überfordern.

## 2. Visuelle Identität

### Farbpalette
*   **Primär (Indigo):** `#4F46E5` – Wird für primäre Aktionen, Navigation und Branding verwendet.
*   **Erfolg (Emerald):** `#10B981` – Signalisiert "System OK" oder "Healthy".
*   **Fehler (Rose):** `#F43F5E` – Markiert kritische Probleme und Fehlermeldungen.
*   **Hintergrund:** Ein sehr helles Grau/Blau (`#F8FAFC`), um Tiefe und Kontrast zu den weißen Cards zu erzeugen.

### Typografie
*   **Schriftart:** `Manrope`
*   **Eigenschaften:** Modern, geometrisch und hochgradig lesbar auf Bildschirmen.
*   **Hierarchie:** Starke Kontraste zwischen Headlines (Bold, Dark Slate) und Fließtext (Medium/Regular, Slate).

### Formsprache
*   **Abrundung (Roundness):** `8px` (Round Eight) für Cards und Buttons, um eine moderne, aber professionelle Anmutung zu bewahren.
*   **Schatten:** Dezente `shadow-sm` für Ebenentrennung ohne visuelle Unruhe.

## 3. Komponenten-Richtlinien

### Cards
*   Dashboards werden in weißen Cards mit dezentem Rahmen dargestellt.
*   Wichtige Metriken (Latenz, Status) erhalten innerhalb der Card eigene Sub-Sektionen mit Icons.

### Status-Indikatoren
*   Verwendung von gefüllten Kreisen mit Icons (Checkmark für OK, X für Error).
*   Farbliche Akzente am Rand oder im Hintergrund von Fehlermeldungen zur schnellen Erfassbarkeit.

### Navigation
*   **SideBar:** Fokus auf die Hauptbereiche (Overview, Dashboards, Alerts).
*   **TopBar:** Bietet globalen Kontext, Suche und Profilzugriff.

## 4. UX-Patterns
*   **Check History:** Fehler werden hierarchisch ganz oben platziert ("Critical Issue" Box).
*   **Progressive Disclosure:** Details zu Fehlern sind standardmäßig sichtbar, wenn relevant, aber kompakt formatiert, um die Historie nicht zu sprengen.
*   **Feedback-Loops:** Schaltflächen wie "Check Now" bieten sofortige Interaktionsmöglichkeit bei Problemen.
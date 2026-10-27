# Fixify

**See the problem. Understand it. Fix it.**
Native iOS-App (SwiftUI, iOS 26+): Kamera auf ein Problem richten → Fixify erkennt Text lokal, analysiert mit Claude, markiert relevante Bildstellen und führt Schritt für Schritt bis zur selbst überprüften Lösung.

```
SCAN → DETECT → UNDERSTAND → GUIDE → FIX → VERIFY
```

## Aufbau

| Ordner | Inhalt |
|---|---|
| `Fixify/` | iOS-App (Swift/SwiftUI, SwiftData, Vision, VisionKit, AVFoundation, PhotosUI, StoreKit 2, FoundationModels) |
| `FixifyTests/` | Unit-Tests (Swift Testing) |
| `worker/` | **Fixify Cloud** (Cloudflare Workers): kostenlose KI (Groq) + Texterkennung (OCR.space) für alle Nutzer, mit Tageslimits. Einrichtung: [docs/Fixify-Cloud.md](docs/Fixify-Cloud.md) |
| `app/` | Expo-Go-Version der App (Expo SDK 58) |
| `server/` | Optionaler eigener Server (Node.js). Hält den Anthropic-Key, ruft `claude-opus-5-5` mit Structured Outputs auf |
| `tools/` | App-Icon-Generator, String-Katalog-Builder + deutsche Übersetzungen (`de.json`) |
| `project.yml` | XcodeGen-Projektdefinition (das `.xcodeproj` wird generiert, nicht eingecheckt) |
| `.github/workflows/ios.yml` | Cloud-Build auf macOS: Tests + unsignierte IPA |

## Schnellstart mit Expo Go (empfohlen zum Testen)

Die Expo-Version in `app/` läuft direkt in **Expo Go** auf dem iPhone: QR-Code scannen, fertig. Kein Sideloadly, keine 7-Tage-Grenze.
Schritt für Schritt: [docs/Expo-Go.md](docs/Expo-Go.md). Die Texterkennung übernimmt dabei der Proxy auf deinem PC (Tesseract, lokal).

| | Swift-App (`Fixify/`) | Expo-App (`app/`) |
|---|---|---|
| Installation | Cloud-Build + Sideloadly | Expo Go, QR-Code |
| Texterkennung | Apple Vision auf dem iPhone, Live-Rahmen | Tesseract auf dem PC |
| Dokumentenscanner, Abo, On-Device-KI | ja | nein |

## 1. Analyse-Server starten (Windows/Mac/Linux)

```bash
cd server
npm install
```

`server/.env` öffnen und den Key eintragen (die Datei wird beim ersten Start angelegt):

```
ANTHROPIC_API_KEY=sk-ant-...
```

```bash
npm start
```

Das Fenster zeigt **Server-URL** (z. B. `http://192.168.178.134:8787`) und **App-Token**. Beides in Fixify unter *Einstellungen → KI-Analyse* eintragen und *Verbindung testen*. iPhone und PC müssen im selben WLAN sein; die Windows-Firewall-Abfrage für Node erlauben.

Schutz: Token-Pflicht, Rate-Limit (Standard 6/min, 200/Tag), Größenlimits, Schema-Validierung, Timeouts. Geloggt werden nur Dauer und Token-Zahlen, nie Bilder oder Text. Optionen siehe `server/.env.example`.

## 2. App bauen (ohne Mac)

Swift lässt sich nur auf macOS kompilieren. Der Workflow `.github/workflows/ios.yml` erledigt das in der Cloud:

1. GitHub-Konto anlegen, privates Repo erstellen, dieses Projekt pushen.
2. Unter *Actions* läuft **Build & test** automatisch (Proxy-Tests, iOS-Unit-Tests im Simulator, Release-Build).
3. Das Artefakt **Fixify-unsigned-ipa** herunterladen.
4. Mit [Sideloadly](https://sideloadly.io) (Windows) installieren – Schritt-für-Schritt: [docs/iPhone-Installation.md](docs/iPhone-Installation.md). Kurzfassung: IPA mit deiner Apple-ID signieren und aufs iPhone installieren. Mit kostenloser Apple-ID läuft die App 7 Tage und muss dann neu signiert werden. Auf dem iPhone: *Einstellungen → Allgemein → VPN & Geräteverwaltung* → Entwickler vertrauen, außerdem *Entwicklermodus* aktivieren.

Mit Apple Developer Account (99 $/Jahr) geht es stattdessen per TestFlight; dafür muss `DEVELOPMENT_TEAM` in `project.yml` gesetzt und Signing im Workflow ergänzt werden.

Auf einem Mac: `brew install xcodegen && xcodegen generate && open Fixify.xcodeproj`.

## Was echt ist und was nicht

- **Live-Rahmen in der Kamera** = Apple Vision Texterkennung auf den Live-Frames (lokal, echt). Die KI-Analyse läuft erst *nach* der Aufnahme und ist so beschriftet.
- **Markierungen**: durchgezogen = exakte Koordinaten aus lokaler Texterkennung; gestrichelt = Position von der KI geschätzt (nur bei Konfidenz „mittel/hoch“); sonst keine Markierung, nur Text.
- **Analysezustände** zeigen nur echte Phasen (Vorbereiten → Server analysiert → Ergebnis prüfen), abbrechbar.
- **Video**: bis 10 s, wird in 3 Einzelbilder zerlegt und wie Fotos analysiert. Keine kontinuierliche Videoanalyse.
- **Ohne Server**: Texterkennung, Dokumentenscan, Sessions und Bibliothek funktionieren lokal. Optional Apple-On-Device-Modell (nur Text, kein Bild; Geräte mit Apple Intelligence), klar gekennzeichnet.
- **Nie** wird ein Problem automatisch als gelöst markiert – der Nutzer prüft die Erfolgskriterien selbst.

## Fixify Pro / StoreKit

Limits stehen zentral in `Fixify/Pro/Limits.swift` (Free: 15 Analysen/Monat, 3 Plan-Updates/Session, 2 Fotos/Analyse, 30 Sessions). Produkt-IDs: `app.fixify.pro.monthly`, `app.fixify.pro.yearly`. `Fixify/Resources/Fixify.storekit` ist für lokale Tests in Xcode. Echte Käufe brauchen die Produkte in App Store Connect. Solange sie fehlen, zeigt die Paywall ehrlich „nicht verfügbar“. Die Paywall erscheint nur bei erreichtem Limit oder auf Wunsch, ohne Countdown. Die Limits werden in der App gezählt; der Proxy hat zusätzlich sein eigenes Rate-Limit.

## Übersetzungen

Quelltexte sind Englisch, Deutsch steht in `tools/de.json`. Nach Textänderungen:

```bash
python tools/build_strings.py
```

Das Skript erzeugt `Localizable.xcstrings` und bricht ab, wenn eine deutsche Übersetzung fehlt (läuft auch in CI).

## Tests

```bash
cd server && npm test
```

iOS-Tests laufen in CI (`xcodebuild test`).

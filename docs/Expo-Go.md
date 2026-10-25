# Fixify in Expo Go starten (iPhone + Windows)

Die Expo-Version liegt im Ordner `app/`. Sie läuft direkt in der App **Expo Go**, ohne Sideloadly, ohne Kabel und ohne 7-Tage-Grenze.
Zeitbedarf beim ersten Mal: ca. 10 Minuten.

## Was du brauchst
- iPhone und PC im **selben WLAN**
- **Expo Go** aus dem App Store (kostenlos)
- Node.js auf dem PC (ist bei dir schon installiert)

## 1. Analyse-Server starten (Fenster 1)
```bash
cd C:\Users\erdem\Projects\Fixify\server
npm install
npm start
```
- In `server\.env` muss `ANTHROPIC_API_KEY=sk-ant-…` stehen. Danach den Server neu starten.
- Das Fenster zeigt **Server URL** und **App token**. Lass es offen.
- Fragt die Windows-Firewall nach Zugriff, erlaube **„Private Netzwerke“**.
- Beim ersten Foto lädt der Server einmalig die Daten für die Texterkennung (ca. 15 MB) herunter.

## 2. App starten (Fenster 2)
```bash
cd C:\Users\erdem\Projects\Fixify\app
npm install
npx expo start
```
Im Fenster erscheint ein **QR-Code**.

## 3. Auf dem iPhone öffnen
1. Die normale **Kamera-App** öffnen und auf den QR-Code richten.
2. Auf den Hinweis **„In Expo Go öffnen“** tippen.
3. Das Laden dauert beim ersten Mal 20–60 Sekunden.
4. Erlaube die Abfragen **Kamera** und **Lokales Netzwerk**.

## 4. Fixify mit dem Server verbinden
1. In Fixify unter **Einstellungen → KI-Analyse** Server-Adresse und App-Token aus Fenster 1 eintragen.
2. Auf **Verbindung testen** tippen. Dort sollte **„Verbunden“** stehen.

## Gut zu wissen
- Die App läuft nur, solange `npx expo start` in Fenster 2 läuft. Deine Sessions bleiben trotzdem auf dem iPhone gespeichert.
- Für Texterkennung und Analyse muss der Server in Fenster 1 laufen. Ohne Server kannst du Fotos und Beschreibungen speichern und später analysieren.
- Codeänderungen erscheinen sofort auf dem iPhone. Sonst in Expo Go das iPhone schütteln und **Reload** wählen.

## Wenn es hakt
| Problem | Lösung |
|---|---|
| Expo Go findet den PC nicht | Selbes WLAN? Firewall für Node erlaubt? Alternativ `npx expo start --tunnel` (fragt einmal, ob ein Zusatzpaket installiert werden soll: mit **Y** bestätigen) |
| „Project is incompatible with this version of Expo Go“ | Expo Go im App Store aktualisieren (die App nutzt SDK 58) |
| „Der Fixify-Server ist nicht erreichbar“ | Läuft Fenster 1? Hat sich die IP-Adresse geändert? Lokales Netzwerk erlauben: *iPhone-Einstellungen → Datenschutz & Sicherheit → Lokales Netzwerk → Expo Go* |
| „Server hat keinen API-Schlüssel“ | Key in `server\.env` eintragen und Fenster 1 neu starten (`Strg+C`, dann `npm start`) |
| Kamera bleibt schwarz | Expo Go die Kamera erlauben: *iPhone-Einstellungen → Expo Go → Kamera* |

## Unterschiede zur nativen Swift-Version
- Die Texterkennung läuft auf deinem PC (Tesseract), nicht auf dem iPhone. Live-Rahmen im Kamerabild gibt es deshalb nicht.
- Kein automatischer Dokumentenscanner. Fotos, Video (3 Einzelbilder) und Import aus Fotos funktionieren.
- Keine Abo-Käufe und keine On-Device-KI von Apple.

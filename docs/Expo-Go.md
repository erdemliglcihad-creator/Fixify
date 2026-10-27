# Fixify in Expo Go starten (iPhone + Windows)

Die Expo-Version liegt im Ordner `app/`. Sie läuft direkt in der App **Expo Go**, ohne Sideloadly, ohne Kabel und ohne 7-Tage-Grenze.
Zeitbedarf beim ersten Mal: ca. 10 Minuten.

## Was du brauchst
- iPhone und PC im **selben WLAN**
- **Expo Go** aus dem App Store (kostenlos)
- Node.js auf dem PC (ist bei dir schon installiert)

## 1. KI einmalig einrichten
Die Analyse läuft über **Fixify Cloud**, kostenlos und ohne dass dein PC laufen muss. Einmalig veröffentlichen: [Fixify-Cloud.md](Fixify-Cloud.md). Danach steht die Adresse in `app\.env`, und jeder Nutzer kann sofort analysieren.

## 2. App starten
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

## 4. Prüfen
Unter **Einstellungen → KI-Analyse** steht **Fixify Cloud**. Ein Tipp auf **Verbindung testen** sollte **„Verbunden“** zeigen, darunter die kostenlosen Analysen, die heute noch übrig sind.

## Gut zu wissen
- Die App läuft nur, solange `npx expo start` läuft. Deine Sessions bleiben trotzdem auf dem iPhone gespeichert.
- Texterkennung und Analyse laufen über Fixify Cloud, dein PC muss dafür nicht an sein. Pro Gerät gibt es 10 kostenlose Analysen am Tag.
- Codeänderungen erscheinen sofort auf dem iPhone. Sonst in Expo Go das iPhone schütteln und **Reload** wählen.

## Wenn es hakt
| Problem | Lösung |
|---|---|
| Expo Go findet den PC nicht | Selbes WLAN? Firewall für Node erlaubt? Alternativ `npx expo start --tunnel` (fragt einmal, ob ein Zusatzpaket installiert werden soll: mit **Y** bestätigen) |
| „Project is incompatible with this version of Expo Go“ | Expo Go im App Store aktualisieren (die App nutzt SDK 58) |
| „Diese Version hat noch keine Fixify-Cloud-Adresse“ | `EXPO_PUBLIC_CLOUD_URL` in `app\.env` eintragen und `npx expo start` neu starten |
| „KI auf dem Server nicht eingerichtet“ | Schlüssel fehlen: `npx wrangler secret put AI_API_KEY` und `OCR_SPACE_KEY` (siehe Fixify-Cloud.md) |
| „Kostenlose Analysen aufgebraucht“ | Tageslimit erreicht, morgen geht es weiter. Limits stehen in `worker/wrangler.jsonc` |
| Kamera bleibt schwarz | Expo Go die Kamera erlauben: *iPhone-Einstellungen → Expo Go → Kamera* |

## Unterschiede zur nativen Swift-Version
- Die Texterkennung läuft in der Cloud (OCR.space), nicht auf dem iPhone. Live-Rahmen im Kamerabild gibt es deshalb nicht.
- Kein automatischer Dokumentenscanner. Fotos, Video (3 Einzelbilder) und Import aus Fotos funktionieren.
- Keine Abo-Käufe und keine On-Device-KI von Apple.

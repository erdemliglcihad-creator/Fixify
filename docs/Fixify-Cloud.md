# Fixify Cloud einrichten (kostenlos, für alle Nutzer)

Fixify Cloud ist ein kleiner Server auf **Cloudflare Workers** (Ordner `worker/`). Er hält die KI-Schlüssel, damit sie nie in der App stecken. Jeder mit der App kann ihn ohne Einrichtung nutzen.

| Teil | Dienst | Kosten |
|---|---|---|
| Server | Cloudflare Workers + Durable Objects | 0 € (Gratis-Tarif) |
| KI-Analyse | Groq, Modell `qwen/qwen3.8-27b` | 0 € (Gratis-Tarif) |
| Texterkennung | OCR.space | 0 € (25.000 Anfragen/Monat) |

Zeitbedarf: etwa 15 Minuten. Die Konten legst du selbst an, Schlüssel tippst du nur in dein eigenes Terminal ein.

## 1. Kostenlose Konten
1. **Cloudflare:** [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
2. **Groq:** [console.groq.com](https://console.groq.com) → *API Keys* → *Create API Key*. Den Schlüssel kopieren, er wird nur einmal angezeigt.
3. **OCR.space (optional):** [ocr.space/ocrapi/freekey](https://ocr.space/ocrapi/freekey) → E-Mail eintragen. Der Schlüssel kommt per Mail. Ohne ihn läuft die Analyse trotzdem, nur ohne exakte Markierungen auf erkanntem Text.

## 2. Server veröffentlichen
```bash
cd C:\Users\erdem\Projects\Fixify\server
npm install
```
```bash
cd C:\Users\erdem\Projects\Fixify\worker
npm install
npx wrangler login
```
Es öffnet sich der Browser, dort Cloudflare erlauben.
```bash
npx wrangler deploy
```
Am Ende steht eine Adresse wie `https://fixify-cloud.DEINNAME.workers.dev`. **Die brauchst du gleich.**

## 3. Schlüssel hinterlegen
```bash
npx wrangler secret put AI_API_KEY
```
Den Groq-Schlüssel einfügen und Enter drücken.
```bash
npx wrangler secret put OCR_SPACE_KEY
```
Den OCR.space-Schlüssel einfügen und Enter drücken. Die Schlüssel liegen danach verschlüsselt bei Cloudflare, nicht im Code und nicht in der App.

Test im Browser: `https://fixify-cloud.DEINNAME.workers.dev/health` sollte `"configured":true` und `"ocr":true` zeigen.

## 4. Adresse in die App eintragen
In `app\.env`:
```
EXPO_PUBLIC_CLOUD_URL=https://fixify-cloud.DEINNAME.workers.dev
```
Danach `npx expo start` neu starten. In Fixify unter *Einstellungen → KI-Analyse* steht jetzt **Fixify Cloud**. Ein Tipp auf **Verbindung testen** sollte „Verbunden“ zeigen.

## Limits (in `worker/wrangler.jsonc`, Abschnitt `vars`)
| Einstellung | Standard | Bedeutung |
|---|---|---|
| `UPLOADS_DAILY` | 10 | Verschiedene Fotos pro Gerät und Tag (Analyse und FixBot zusammen, dasselbe Foto zählt einmal) |
| `IP_UPLOADS_DAILY` | 30 | Fotos pro Internetanschluss und Tag (falls jemand Geräte-IDs fälscht) |
| `MESSAGES_DAILY` | 150 | Verdecktes Fair-Use-Limit für Nachrichten und Analysen ohne Foto |
| `GLOBAL_VISION_DAILY` | 50 | Bildanfragen für **alle** zusammen pro Tag |
| `GLOBAL_OCR_DAILY` | 450 | Texterkennungen für alle pro Tag |
| `CHAT_MODELS` | `gpt-oss-120b, gpt-oss-20b, llama-3.1-8b-instant` | FixBot-Modelle in Reihenfolge; ist eines ausgelastet, antwortet automatisch das nächste |

Warum nur 50 Bildanfragen für alle? Groq gibt pro Modell etwa 200.000 Tokens am Tag gratis, eine Anfrage mit Foto braucht etwa 4.000 bis 7.000. Text-Chats laufen über eigene Modelle mit eigenem Kontingent. Nach Änderungen erneut `npx wrangler deploy` ausführen. Fehlgeschlagene Analysen zählen nicht.

## Anbieter wechseln (ohne die App neu zu bauen)
- **Anderer Gratis-Anbieter** (OpenAI-kompatibel, z. B. Mistral): In `wrangler.jsonc` `AI_BASE_URL`, `AI_MODEL` und `AI_PROVIDER_NAME` ändern, dann `npx wrangler secret put AI_API_KEY` mit dem neuen Schlüssel und `npx wrangler deploy`.
- **Claude** (kostenpflichtig, beste Qualität): `"AI_PROVIDER": "anthropic"` setzen, `npx wrangler secret put ANTHROPIC_API_KEY`, dann deployen.
- **Nur mit Einladung:** `npx wrangler secret put APP_TOKEN` setzen. Dann können nur Nutzer mit diesem Token analysieren (*Einstellungen → Eigener Server*).

## Was du wissen solltest
- **Daten:** Fotos und Text gehen bei einer Analyse an OCR.space und Groq (Server in den USA). Die App fragt vorher um Erlaubnis und erklärt das unter *Einstellungen → Was Fixify verarbeitet*.
- **Gratis-Bedingungen:** Ob OCR.space und Groq ihre Gratis-Tarife für eine öffentliche App erlauben, ist auf deren Seiten nicht eindeutig geregelt. Prüfe das, bevor du die App veröffentlichst.
- **Modellnamen ändern sich:** Wenn Groq `qwen/qwen3.8-27b` abschaltet, steht in den Worker-Logs ein Fehler. Dann in `wrangler.jsonc` ein aktuelles Bildmodell aus [console.groq.com/docs/vision](https://console.groq.com/docs/vision) eintragen.

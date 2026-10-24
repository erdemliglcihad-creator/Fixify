# Fixify auf dem iPhone installieren (Windows + Sideloadly)

Für: iPhone 13 mit **iOS 26**, Windows-PC, kostenlose Apple-ID.
Zeitbedarf beim ersten Mal: ca. 30–45 Minuten. Danach alle 7 Tage ca. 2 Minuten zum Auffrischen.

---

## Teil 0 – Vorher prüfen

1. **iOS-Version:** iPhone → *Einstellungen → Allgemein → Info → iOS-Version*. Es muss **26.0 oder neuer** sein, sonst *Einstellungen → Allgemein → Softwareupdate*. Das iPhone 13 bekommt iOS 26.
2. **Lightning-Kabel**, das Daten überträgt (nicht nur ein Ladekabel).
3. **Apple-ID mit Passwort** und Zugriff auf die Zwei-Faktor-Codes. Wenn dir das lieber ist, kannst du dafür auch eine zweite, extra angelegte Apple-ID verwenden.
4. PC und iPhone im **selben WLAN** (wichtig für den Analyse-Server später).

> Hinweis zum iPhone 13: Apple Intelligence gibt es darauf nicht. Die Option „Auf diesem iPhone (nur Text)“ in den Fixify-Einstellungen ist deshalb nicht verfügbar. Nutze **„Fixify-Server (Claude)“**.

---

## Teil 1 – Windows vorbereiten (einmalig)

Sideloadly braucht **iTunes und iCloud von Apples Website**. Die Versionen aus dem Microsoft Store funktionieren damit nicht.

1. *Windows-Einstellungen → Apps → Installierte Apps*: Wenn **iTunes** oder **iCloud** aus dem Microsoft Store installiert sind, beide **deinstallieren**.
2. Auf [sideloadly.io](https://sideloadly.io) die dort verlinkten **Web-Versionen** von **iTunes (64-bit)** und **iCloud** herunterladen und installieren.
3. **Sideloadly für Windows** von [sideloadly.io](https://sideloadly.io) herunterladen und installieren.
4. PC neu starten.

---

## Teil 2 – Die App-Datei (IPA) herunterladen

1. Bei GitHub einloggen und [github.com/erdemliglcihad-creator/Fixify/actions](https://github.com/erdemliglcihad-creator/Fixify/actions) öffnen.
2. Den obersten Lauf **„Build & test“** mit grünem Haken anklicken.
3. Ganz unten unter **Artifacts** auf **Fixify-unsigned-ipa** klicken. Eine ZIP-Datei wird geladen.
4. ZIP entpacken (Rechtsklick → *Alle extrahieren*). Darin liegt **`Fixify-unsigned.ipa`**.

> Artefakte werden nach 14 Tagen gelöscht. Für eine frische IPA: auf der Actions-Seite links **„Build & test“** wählen → **Run workflow** → **Run workflow**. Nach ca. 5–10 Minuten ist eine neue IPA da.

---

## Teil 3 – iPhone mit dem PC verbinden

1. iPhone per Kabel anschließen und **entsperren**.
2. Auf dem iPhone erscheint **„Diesem Computer vertrauen?“** → **Vertrauen** → Code eingeben.
3. iTunes öffnen und prüfen, ob oben links das iPhone-Symbol erscheint. Danach kannst du iTunes wieder schließen.

---

## Teil 4 – Fixify mit Sideloadly installieren

1. **Sideloadly** öffnen.
2. Bei **iDevice** dein iPhone auswählen.
3. Bei **Apple account** deine Apple-ID (E-Mail) eintragen.
4. Die Datei **`Fixify-unsigned.ipa`** auf das große IPA-Symbol links ziehen.
5. Auf **Start** klicken.
6. Passwort der Apple-ID eingeben. Wenn ein **Bestätigungscode** kommt, den Code von deinem iPhone bzw. per SMS eingeben.
7. Unten im Log läuft der Vorgang. Am Ende steht **„Done.“**

---

## Teil 5 – Auf dem iPhone freischalten (einmalig)

**A) Entwicklermodus einschalten**
1. *Einstellungen → Datenschutz & Sicherheit* ganz nach unten scrollen → **Entwicklermodus** → einschalten.
2. Das iPhone startet neu. Nach dem Neustart **Einschalten** bestätigen und den Code eingeben.

> Erscheint der Punkt „Entwicklermodus“ nicht, öffne einmal das Fixify-Icon. Danach taucht er auf.

**B) Deiner Apple-ID vertrauen**
1. *Einstellungen → Allgemein → VPN & Geräteverwaltung*.
2. Unter **Entwickler-App** deine Apple-ID antippen → **„… vertrauen“** → **Vertrauen**. Dafür braucht das iPhone kurz Internet.

Jetzt lässt sich **Fixify** vom Homescreen öffnen.

---

## Teil 6 – Analyse-Server auf dem PC starten

1. Eine Eingabeaufforderung bzw. ein Terminal im Ordner `C:\Users\erdem\Projects\Fixify\server` öffnen.
2. Nur beim ersten Mal: `npm install`
3. Die Datei `server\.env` mit einem Editor öffnen und deinen Schlüssel eintragen:
   ```
   ANTHROPIC_API_KEY=sk-ant-…
   ```
   Die Zeile `FIXIFY_APP_TOKEN=…` darin nicht löschen.
4. Den Server starten: `npm start`
5. Fragt die **Windows-Firewall** nach Zugriff für Node.js, **„Private Netzwerke“ erlauben**.
6. Im Fenster stehen jetzt **Server URL** (z. B. `http://192.168.178.134:8787`) und **App token**. Das Fenster offen lassen, solange du Fixify nutzt.

---

## Teil 7 – Fixify mit dem Server verbinden

1. In Fixify: **Einstellungen → KI-Analyse → Analyse: „Fixify-Server (Claude)“**.
2. **Server-Adresse** und **App-Token** aus dem Server-Fenster eintragen.
3. Auf **Verbindung testen** tippen. Fragt iOS **„Fixify möchte Geräte im lokalen Netzwerk finden“**, tippe auf **Erlauben**.
4. Steht dort **„Verbunden“**, ist alles fertig. Zum Ausprobieren: *Start → Kamera öffnen →* eine Fehlermeldung fotografieren → **Weiter → Analysieren**.

---

## Alle 7 Tage: App auffrischen

Mit einer kostenlosen Apple-ID ist die Signatur **7 Tage** gültig. Danach öffnet sich Fixify nicht mehr. Deine Daten bleiben trotzdem erhalten, solange du die App nicht löschst.

- **Manuell:** iPhone anschließen → Sideloadly → dieselbe IPA → **Start**. Die App wird überschrieben, und die Sessions bleiben.
- **Automatisch:** In Sideloadly die Auto-Refresh-Funktion aktivieren (Sideloadly-Daemon). Der PC muss dann laufen und das iPhone im selben WLAN sein. Für WLAN-Verbindungen braucht Windows eventuell Apples **Bonjour**-Dienst.

Grenzen einer kostenlosen Apple-ID: höchstens **3 selbst installierte Apps** gleichzeitig und **10 neue App-IDs pro 7 Tage**.

---

## Häufige Probleme

| Problem | Lösung |
|---|---|
| Sideloadly findet das iPhone nicht | iPhone entsperren, „Vertrauen“ bestätigen, iTunes-Web-Version prüfen (Teil 1), anderes Kabel bzw. anderen USB-Port probieren |
| „Maximum App ID limit reached“ | 7 Tage warten oder eine andere Apple-ID verwenden |
| App-Symbol da, aber „Nicht vertrauenswürdiger Entwickler“ | Teil 5 B |
| App öffnet sich nicht und fragt nach dem Entwicklermodus | Teil 5 A |
| App öffnet sich nach einer Woche nicht mehr | Abgelaufen, siehe „Alle 7 Tage“ |
| „Der Fixify-Server ist nicht erreichbar“ | Läuft `npm start`? Beide Geräte im selben WLAN? Firewall-Freigabe für Node erteilt? Ist die IP im Server-Fenster neu (die PC-IP kann sich ändern)? Lokales Netzwerk erlaubt (*iPhone-Einstellungen → Datenschutz & Sicherheit → Lokales Netzwerk → Fixify*)? |
| „Der Server hat das App-Token abgelehnt“ | Token exakt aus dem Server-Fenster kopieren (ohne Leerzeichen) |
| „Server hat keinen API-Schlüssel“ | `ANTHROPIC_API_KEY` in `server\.env` eintragen und den Server neu starten |
| Fixify Pro „nicht verfügbar“ | Erwartet: Käufe funktionieren erst mit App-Store-Produkten und einem bezahlten Developer Account |

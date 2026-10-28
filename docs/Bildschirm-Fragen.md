# Frag Fixify: Fragen zu deinem Bildschirm (native Swift-App)

Du siehst etwas in einer anderen App (z. B. einen Anime auf TikTok) und willst wissen, was es ist,
ohne Fixify zu öffnen. Fixify antwortet in einer kleinen Karte oben und liest die Antwort vor.

Gilt für die native Swift-App (`Fixify/`, Installation per Sideloadly, siehe `iPhone-Installation.md`).
Expo Go kann keine Kontrollzentrum-Buttons und keine Bildschirmaufnahme.

## Einmal einrichten

1. Fixify öffnen → Tab **FixVoice** → einmal tippen und **Erlauben** (Sprache, Fragen und Bildschirmfotos
   gehen an Fixify Cloud).
2. Kontrollzentrum öffnen → oben links **Bearbeiten** → **Steuerelement hinzufügen** → nach „Fixify“ suchen →
   **Frag Fixify** hinzufügen.

## Weg 1: Mit Bildschirmaufnahme (Kontrollzentrum)

1. Kontrollzentrum → **Bildschirmaufnahme lange drücken** → **Fixify** wählen → **Übertragung starten**.
   (iOS verlangt diese Bestätigung jedes Mal. Apps dürfen andere Apps nicht von selbst aufnehmen.)
2. Zurück in TikTok → Kontrollzentrum → **Frag Fixify**.
3. Frage sprechen oder tippen. Die Antwort erscheint oben und wird vorgelesen.
4. Die Aufnahme endet automatisch nach der Antwort. Es wird kein Video gespeichert, nur das aktuelle Bild
   geht einmal an die KI.

Alternativ startet der **Bildschirm**-Ring in der schwarzen Leiste im FixVoice-Tab die Aufnahme.

## Weg 2: Ohne Aufnahme (Bildschirmfoto-Kurzbefehl, am bequemsten)

1. App **Kurzbefehle** → neuer Kurzbefehl:
   - Aktion **Bildschirmfoto aufnehmen**
   - Aktion **Frag Fixify**, als „Screenshot“ das Bildschirmfoto wählen
2. **Einstellungen → Bedienungshilfen → Tippen → Auf Rückseite tippen → Doppeltippen** → den Kurzbefehl wählen.
   Optional: den Kurzbefehl auch ins Kontrollzentrum legen (Steuerelement „Kurzbefehl“).
3. In jeder App zweimal auf die iPhone-Rückseite tippen → fragen → Antwort.

## Grenzen (von iOS vorgegeben)

- Keine schwebenden Buttons oder Leisten über anderen Apps. Die Karte erscheint oben wie bei Siri.
- Die Bildschirmaufnahme braucht immer die iOS-Bestätigung.
- Jede Frage mit Bild zählt als 1 der 10 Foto-Uploads pro Tag.
- Mit kostenlosem Apple-Konto (Sideloadly) kann der gemeinsame Speicher zwischen App und Aufnahme fehlen.
  Dann klappt Weg 2 trotzdem, Weg 1 nicht.

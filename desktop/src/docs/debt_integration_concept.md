# Konzept: Integration von Schulden / Verbindlichkeiten

Diese Datei dokumentiert Überlegungen zur zukünftigen Erweiterung des Ruhestandsplaners um eine Schuldenbetrachtung.

## Status Quo
Das Tool ist aktuell auf die Simulation von **Guthaben (Assets)** optimiert. Schulden werden nicht explizit als eigene Kategorie geführt.

## Herausforderungen
1. **Mathematische Differenzierung**: Annuitätendarlehen (Zins + Tilgung) verhalten sich anders als einfache Sparkonten.
2. **Nutzerführung**: Schulden sind psychologisch belastend; ein zu komplexes Tool könnte Einsteiger abschrecken.
3. **Scheingenauigkeit**: Zu viele Parameter (Sollzins, Tilgungssatz, Zinsbindung) suggerieren eine Präzision, die über 30 Jahre ohnehin nicht haltbar ist.

## Zukünftige Lösungsansätze

### Ansatz A: Der "Nettokapital-Topf" (Minimal-Invasiv)
- Nutzer geben Schulden als negativen Startwert in einem Anlagetopf ein.
- Zinssatz wird als Sollzins interpretiert.
- **Vorteil**: Keine Code-Änderung an der Rechenlogik nötig.
- **Nachteil**: UI-Beschriftungen ("Sparrate", "Zinsertrag") passen begrifflich nicht zu Schulden.

### Ansatz B: Der "Schulden-Schalter" (Empfohlen)
- Im Topf-Editor gibt es eine Checkbox: `[ ] Dieser Topf ist eine Verbindlichkeit (Kredit)`.
- Wenn aktiv, ändern sich die Labels im UI:
    - "Startwert" -> "Restschuld"
    - "Sparrate" -> "Monatliche Rate (Zins+Tilgung)"
    - "Zinsertrag" -> "Kreditzins"
- **Logik-Erweiterung**: Der Topf stoppt automatisch bei Erreichen von 0 € (Kredit ist getilgt).

### Ansatz C: Separates Schulden-Modul
- Ein eigener Tab "Schulden" mit speziellen Rechnern für Hypotheken vs. Konsumkredite.
- **Vorteil**: Höchste Genauigkeit.
- **Nachteil**: Erhöht die Komplexität des Tools deutlich.

---
*Erstellt am 02.03.2026 im Rahmen der Refactoring-Session.*

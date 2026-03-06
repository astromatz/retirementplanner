# Hilfe & Wissen — Konzept & Implementierungsgrundlage

**Zweck dieses Dokuments:** Übergabe an den Entwickler. Enthält alle konzeptionellen Entscheidungen, Architektur, Inhaltsstruktur und Implementierungshinweise aus der Designphase.

---

## 1. Ausgangslage & Ziel

Das Tool richtet sich primär an **totale Laien ohne Finanzvorwissen**. Diese Nutzergruppe hat zwei parallele Probleme: Sie verstehen das Tool nicht und sie verstehen das Thema nicht. Das Hilfesystem löst beide — zur richtigen Zeit, nicht auf einmal.

**Leitprinzip: „Just in time"** — Erklärung genau dann, wenn sie gebraucht wird.

---

## 2. Architektur: Zwei Schichten

### Schicht 1 — Kontextsensitive Tooltips (inline, überall)

Jedes nicht-triviale Eingabefeld bekommt ein `ⓘ`-Icon. Tippen öffnet ein Popup.

**Struktur jedes Tooltips — drei Elemente:**
1. **Was ist das?** — Begriff in einem Satz
2. **Daumenregel** — konkreter Anhaltspunkt für die eigene Situation
3. **Deep-Link** — „Mehr dazu → [Kartenname] ↗" führt direkt zur passenden Karte im Hilfe-Screen

Tooltips sind **kurz und entlasten** — sie müssen nicht alles erklären. Wer mehr will, folgt dem Deep-Link.

**Pflichtfelder für Tooltips (aktuell unzureichend):**

| Feld | Tab | Deep-Link-Ziel |
|---|---|---|
| Rendite Ansparphase | Sparphase | Karte 3 (Zins) |
| Rendite Rentenphase | Sparphase | Karte 3 (Zins) |
| Steuerrate | Sparphase | Karte 5 (Töpfe) |
| Inflationsrate | Strategie | Karte 4 (Inflation) |
| Kaufkraft-Toggle | Chart | Karte 4 (Inflation) |
| Entnahmestrategie | Strategie | — |

---

### Schicht 2 — Hilfe-Screen (eigener Screen)

Kein Tab im Editor-Panel, kein Modal, kein Overlay. Ein **vollständiger eigener Screen**, der über die Kopfleiste erreichbar ist.

**Begründung:** Mobile hat bereits Chart, KPI-Bar, Tabelle und Editor-Panel mit Tabs. Ein weiterer Tab wäre der neunte Gedanke auf einem 6-Zoll-Bildschirm. Der eigene Screen gibt Platz und macht den Kontextwechsel explizit — der Nutzer verlässt bewusst den Plan und kehrt bewusst zurück.

---

## 3. Einstiegspunkte

### 3.1 Landing Page — vierte Kachel

Neue Kachel **„Hilfe & Wissen"** in voller Breite unterhalb der drei bestehenden Kacheln. Farblich abgesetzt (warm/orange) um zu signalisieren: anderer Typ von Aktion.

- Icon: 📖
- Badge: „Vor dem Start lesen"
- Ziel: Hilfe-Screen

### 3.2 Dashboard-Kopfleiste — neuer Button

Neuer `📖 Hilfe`-Button neben den bestehenden Aktions-Buttons (Wizard, Speichern, Laden, Neu). Farblich warm/orange abgesetzt, damit er nicht mit den Aktions-Buttons verwechselt wird.

- Öffnet den Hilfe-Screen
- Plan bleibt erhalten, Nutzer kehrt per Zurück-Button genau dorthin zurück

### 3.3 Tooltip Deep-Links

Jeder Tooltip enthält einen Link direkt zu einer bestimmten Karte im Hilfe-Screen. Beim Antippen:
1. Hilfe-Screen öffnet sich
2. Die Zielkarte wird automatisch aufgeklappt
3. Kurzer Highlight-Puls auf der Karte
4. Scroll zur Karte
5. Zurück-Button führt **direkt zum Dashboard** (nicht zur Hilfe-Startseite)

---

## 4. Hilfe-Screen: UI-Prinzipien

### Navigation
- Sticky `← Zurück zum Plan`-Button — immer sichtbar, auch tief im Scroll
- Beim Öffnen: immer Scroll-Reset nach oben
- **Keine Tiefennavigation** — der Screen hat genau eine Ebene. Kein Untermenü, keine Links zwischen Karten.

### Karten-Format
- Accordion (aufklappbar), selbes Pattern wie der Editor
- Jede Karte in sich vollständig — kein Scrollen nötig um zu entscheiden ob relevant
- Kein Fortschrittsbalken — kein Pflichtlektüre-Gefühl erzeugen. Es ist eine Referenz, kein Kurs.

### Tool-Hints
Jede Karte endet mit einem `🔧 Im Tool:`-Hinweis. Dieser navigiert beim Antippen direkt zum Dashboard **und aktiviert den richtigen Editor-Tab**. Technisch: `navigateTo('dashboard', 'sparphase')` — die Funktion setzt einen `pendingTab`-Parameter, der beim Ankommen im Dashboard den Tab aktiviert.

---

## 5. Inhaltsstruktur: 6 Karten

### Karte 1 — Wie benutze ich dieses Tool?
**Format:** 4 nummerierte Schritte + Chart-Erklärung + Merksatz

Inhalt:
- Wizard → Dashboard → Anpassen → Speichern
- Chart lesen: Kurve über null = versorgt; darunter = Lücke; ganz rechts = Endstand
- Merksatz: „Du kannst nichts kaputt machen — einfach ausprobieren"

*Bewusst kompakt gehalten. Keine Bedienungsdetails die besser in Tooltips gehören.*

---

### Karte 2 — Dein Plan in Phasen denken
**Teaser:** Ausgaben schwanken — Sparraten auch

Inhalt:
- Drei Lebensphasen mit Ausgaben-Tendenz (farbkodiert grün/blau/rot):
  - Aktiver Ruhestand 60–75: oft höhere Ausgaben
  - Ruhigerer Ruhestand 75–85: oft niedrigere Ausgaben
  - Später Ruhestand 85+: Pflege/Heimkosten, wieder steigend
- Das Phasen-Prinzip im Tool: ab Alter X gilt Wert Y (gilt für Sparrate *und* Rentenbedarf)
- Drei Beispiele: Sparrate erhöhen ab 50 / auf 0 ab 63 / Bedarf senken ab 80
- Bedienung: „+ Phase hinzufügen", Alter eintragen
- Einmalige Ausgaben: Betrag + Alter → einmaliger Abzug vom Vermögen
- Tool-Hint: Rentenphase-Tab → Ruhestands-Phasen & Einmalige Ausgaben

---

### Karte 3 — Zins & Zinseszins: Zeit ist dein größter Hebel
**Teaser:** Warum Rendite & Laufzeit so wichtig sind

Inhalt:
- Zinseszins-Prinzip in einem Satz
- Konkretes Beispiel: 200 €/Monat bei 6 % → 33k / 92k / 200k nach 10/20/30 Jahren
- Warum zwei Rendite-Felder: Ansparphase risikoreicher, Rentenphase konservativer (Schutz vor Crash kurz vor Entnahme)
- Tool-Hint: Sparphase-Tab → Rendite

---

### Karte 4 — Inflation: Das unsichtbare Loch
**Teaser:** Warum 2.800 € in 30 Jahren weniger wert sind

Inhalt:
- 2.800 € heute = ~5.100 € in 30 Jahren bei 2 % Inflation
- Bedarf immer in heutigen Euro eintragen — Tool rechnet Inflation auf
- Kaufkraft-Toggle: zeigt Vermögen in heutigen Euro (entlastet den Vergleich)
- Tool-Hint: Strategie-Tab → Inflationsrate

---

### Karte 5 — Meine Konten richtig einordnen
**Teaser:** Welches Konto ist ein Topf — und welche Werte trägt man ein?

Inhalt:
- Definition Topf: Konto/Depot das man selbst im Ruhestand anzapft
- Referenztabelle (3 Spalten: Kontotyp / Rendite / Steuer):

| Kontotyp | Rendite | Steuer |
|---|---|---|
| ETF-Depot | 5–7 % | 18,5 % |
| Tagesgeld / Festgeld | 2–3 % | 25 % |
| Priv. Rentenversicherung | 3–5 % | individuell |

- Warnsignal-Box: Gesetzliche Rente + betriebliche Altersvorsorge sind **keine Töpfe** → gehören unter „Rentenquellen"
- Merksatz: Steuer auf 0 lassen verfälscht das Ergebnis erheblich

*Bewusst kein Steuerrecht. Nur die Mindestinformation um die Felder korrekt auszufüllen.*

---

### Karte 6 — Typische Fehler — und wie du sie vermeidest
**Teaser:** Die 5 häufigsten Fallstricke

| # | Fehler | Korrektur |
|---|---|---|
| 1 | Rendite zu optimistisch (10 %+) | 5–7 % für ETF-Portfolio |
| 2 | Inflation auf 0 % | Mindestens 2 % |
| 3 | Steuer weglassen | Immer ausfüllen, auch schätzen |
| 4 | Entnahme-Ende zu früh | Bis 90, besser 95 |
| 5 | Bruttorente statt Nettorente | Ca. 15–20 % abziehen |
| 6 | Rente zu optimistisch | Plane konservativer (Puffer) |

- Disclaimer am Ende: kein Ersatz für Finanzberatung

---

## 6. Bewusst weggelassen

- **Karte „Warum reicht die Rente nicht?"** — Motivation des Nutzers vorausgesetzt; Kernaussage lebt als Intro-Satz im Hilfe-Screen: *„Die gesetzliche Rente reicht für die meisten nicht — die Lücke musst du selbst schließen."*
- **Steuerrecht-Details** (Teilfreistellung, Berechnung) — zu komplex, zu einschüchternd; Tabellenwerte in Karte 5 reichen
- **Externe Links** — alles lokal, keine Datenschutzprobleme
- **Produktempfehlungen**
- **Entnahmestrategien (proportional/sequenziell)** — zu nischig für diesen Lernstand; gehört in Tooltip

---

## 7. Implementierungshinweise

### Zustand bei erneutem Öffnen
Empfehlung: Karten beim Öffnen immer zugeklappt, Scroll-Position reset. Einfacher zu implementieren, verhindert Verwirrung. Karten-Zustand persistent als Future Enhancement markieren.

### navigateTo(scene, tab)
Zentrale Funktion für alle Tool-Hints und Deep-Links aus Tooltips:
```javascript
function navigateTo(scene, tab) {
  pendingTab = tab || null;
  showScene(scene);
}
// pendingTab wird bei Ankunft im Dashboard konsumiert:
// highlightTab(pendingTab); pendingTab = null;
```

Mögliche Tab-Werte: `'sparphase'`, `'rentenphase'`, `'strategie'`

### Deep-Link aus Tooltip
```javascript
function deepLink(cardId) {
  showScene('help');              // zum Hilfe-Screen
  card.classList.add('open');     // Zielkarte aufklappen
  card.classList.add('highlighted'); // Puls-Animation
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
```

### Zurück-Button Verhalten
- Aus Tooltip-Deep-Link: zurück zum Dashboard (nicht zur Hilfe-Startseite)
- `previousScene` tracken; beim Zurück immer `previousScene` verwenden

### Kein Fortschrittsbalken
Ursprünglich geplant, nach Review gestrichen. Es ist eine Referenz, kein Kurs — kein Pflichtlektüre-Signal senden.

---

## 8. Tone of Voice

- **Du-Form** durchgehend
- Keine Fachbegriffe ohne Erklärung (Ausnahme: ETF — bekannt genug)
- Keine Angst-Kommunikation — ermunternd, nicht alarmierend
- Merksätze: kurz, direkt, handlungsorientiert (beginnen mit ✅)
- Warnungen: sparsam, konkret, mit Korrektur (beginnen mit ⚠️)

---

*Mockup-Datei: `mockup_anleitung.html` — vollständig klickbar, alle drei Screens (Landing / Dashboard / Hilfe-Screen) mit interaktiven Tooltips, Deep-Links und Tab-Navigation.*

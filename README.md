# Sandboxy

Ein Falling-Sand-Sandbox-Spiel im Browser: Elemente malen und zusehen, wie sie rieseln, fließen, brennen, schmelzen und explodieren.

```bash
npm install
npm run dev      # http://localhost:5173 (auch im LAN erreichbar, z. B. fürs Handy)
npm test         # Regeltests der Simulation
npm run build    # Produktions-Build nach dist/
```

## Bedienung
- **Malen:** linke Maustaste / Finger · **Radieren:** rechte Maustaste · **Pipette:** Mittelklick oder Alt+Klick
- **Werkzeugform** (oben): Freihand `F`, Linie `L`, Rechteck `R`, Füllen `G`, Pipette `I`
- **Rückgängig / Wiederholen:** `Strg/⌘+Z`, `Strg/⌘+Umschalt+Z` (oder die Pfeil-Buttons)
- **Leertaste:** Pause · **.**: Einzelschritt · **[ ]**: Pinselgröße · **+ / −**: Pixelgröße
- **Ansicht:** Normal / Wärmebild `H` / Druck `P`
- **Wind:** Regler oben oder Pfeiltasten ← →
- **Szenen:** Demo-Szenen, Link zur aktuellen Szene kopieren, Speicherplätze, Datei-Export/-Import
- „Übermalen“ ersetzt bestehende Partikel statt nur leere Zellen zu füllen

## Systeme
- **Temperatur:** Wärmeleitung, Schmelzen, Gefrieren, Verdampfen, Brennen
- **Bewegung:** Fallen mit Beschleunigung, Explosionen schleudern Trümmer ballistisch
- **Luft:** Druck und Strömung (auf einem 2×2-groben Raster): Druckwellen, Gebläse treiben Luft durch Röhren
- **Strom:** Impulse durch Leiter; Batterie, Generatoren (Windrad, Dampfturbine), Lampen
- **Logik:** Schalter, Taktgeber, Berührungs-/Hitzesensor, Diode, Verzögerer, NICHT- und UND-Gatter (Gatter zeigen nach rechts: Eingang links bzw. oben/unten, Ausgang rechts). Gebläse mit Kabel laufen nur unter Strom.
- **Strahlung:** Uran/Plutonium (kritische Masse), Abschirmung durch Blei/Wand/Steuerstab, Mutationen
- **Leben:** Pflanzen, Pilze, Ranken, Fische, Ameisen, Vögel, Würmer, Bakterien

## Aufbau
- `src/elements/`: Elementdefinitionen, eine Datei pro Kategorie. Ein neues Element ist ein Objekt in einer dieser Listen (siehe `ElementDef` in `src/sim/types.ts`).
- `src/elements/registry.ts`: wandelt die Definitionen in flache Typed Arrays (`P`) und eine Reaktionstabelle um
- `src/sim/`: Simulation (Bewegung, Temperatur, Reaktionen, Strom, Explosionen, Pinsel). Ruhende 16×16-Blöcke werden übersprungen („schlafende Chunks“), damit auch große Welten flüssig laufen.
- `src/render/`: Canvas-Rendering inklusive Wärmebild
- `src/io/save.ts`: Szenenformat (gzip + base64 in JSON), Speicherplätze im localStorage

In der Browser-Konsole ist die Simulation zum Debuggen unter `window.sandboxy` erreichbar.

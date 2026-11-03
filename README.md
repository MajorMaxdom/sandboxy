# Sandboxy

Ein Falling-Sand-Sandbox-Spiel im Browser: Elemente malen und zusehen, wie sie rieseln, fließen, brennen, schmelzen und explodieren.

```bash
npm install
npm run dev      # http://localhost:5173 (auch im LAN erreichbar, z. B. fürs Handy)
npm test         # Regeltests der Simulation
npm run build    # Produktions-Build nach dist/
```

## Bedienung
- **Malen:** linke Maustaste / Finger · **Radieren:** rechte Maustaste · **Pipette:** Alt+Klick (übernimmt auch Laserfarbe und Feuerwerk-Füllung)
- **Werkzeugform** (oben): Freihand `F`, Linie `L`, Rechteck `R`, Füllen `G`, Pipette `I`
- **Rückgängig / Wiederholen:** `Strg/⌘+Z`, `Strg/⌘+Umschalt+Z` (oder die Pfeil-Buttons)
- **Leertaste:** Pause · **.**: Einzelschritt · **[ ]** oder **Umschalt+Mausrad**: Pinselgröße · **+ / −**: Pixelgröße
- **Zoom:** Mausrad (zur Mausposition), Ansicht ziehen mit mittlerer Maustaste, `0` setzt zurück · am Handy: zwei Finger. Der Zoom ändert die Rastergröße nicht.
- **Ansicht:** Normal / Wärmebild `H` / Druck `P`
- **Wind:** Regler oben oder Pfeiltasten ← →
- **Szenen:** Demo-Szenen, Link zur aktuellen Szene kopieren, Speicherplätze, Datei-Export/-Import
- „Übermalen“ ersetzt bestehende Partikel statt nur leere Zellen zu füllen

## Systeme
- **Temperatur:** Wärmeleitung, Schmelzen, Gefrieren, Verdampfen, Brennen
- **Bewegung:** Fallen mit Beschleunigung, Explosionen schleudern Trümmer ballistisch
- **Luft:** Druck und Strömung (auf einem 2×2-groben Raster): Druckwellen, Gebläse treiben Luft durch Röhren
- **Transport:** Rohre leiten Flüssigkeiten, Pulver und Gase in ihre Richtung, Pumpen drücken Flüssigkeit hinein oder eine Säule hinauf. Mit „Rohr ✎“, „Pumpe ✎“ und „Gebläse ✎“ folgt die Richtung dem Zeichnen.
- **Strom:** Impulse durch Leiter; Batterie, Generatoren (Windrad, Dampfturbine), Lampen
- **Logik:** Schalter, Taktgeber, Berührungs-/Hitze-/Lichtsensor, Diode, Verzögerer, NICHT-, UND-, ODER-, XOR-Gatter und Flipflop (Gatter zeigen nach rechts: Eingang links bzw. oben/unten, Ausgang rechts). Gebläse, Pumpen, Laser und Wasserhahn mit Kabel laufen nur unter Strom.
- **Laser** (Technik, 4 Richtungen): Farbe frei wählbar, der Strahl erhitzt, was er trifft, und geht durch Glas. Mit anderer Farbe über einen Laser malen färbt ihn um. **Spiegel** ╱ ╲ lenken ihn um, **Farbfilter** lassen nur ihre Farbe durch, **Solarzelle** und **Lichtsensor** machen aus Licht Strom.
- **Feuer und Chemie:** Sauerstoff facht Feuer an, CO₂ sinkt zu Boden und erstickt es, Lauge neutralisiert Säure, Alkohol brennt blau, Wachs schmilzt schon bei 60 °C, Ton wird im Feuer zu Ziegel.
- **Technik:** Wasserhahn (gibt ein wählbares Element aus), Förderbänder.
- **Spezial:** Schwarzes Loch, Antimaterie, Konverter (verwandelt in ein wählbares Element), Portale (Eingang und Ausgang mit gleicher Kanalfarbe gehören zusammen).
- **Kohle** (Land): Angezündet wird sie zu Glut, die lange und sehr heiß glüht. Wasser löscht sie.
- **Feuerwerk:** Unter der Palette eine Füllung wählen (z. B. Wasser, Säure, Samen), dann zerplatzt die Rakete in dieses Element statt in Funken.
- **Strahlung:** Uran/Plutonium (kritische Masse), Abschirmung durch Blei/Wand/Steuerstab, Mutationen
- **Leben:** Pflanzen, Pilze, Ranken, Gras, Moos, Algen, Fische, Ameisen, Spinnen, Vögel, Würmer, Bakterien

## Aufbau
- `src/elements/`: Elementdefinitionen, eine Datei pro Kategorie. Ein neues Element ist ein Objekt in einer dieser Listen (siehe `ElementDef` in `src/sim/types.ts`).
- `src/elements/registry.ts`: wandelt die Definitionen in flache Typed Arrays (`P`) und eine Reaktionstabelle um
- `src/sim/`: Simulation (Bewegung, Temperatur, Reaktionen, Strom, Explosionen, Pinsel). Ruhende 16×16-Blöcke werden übersprungen („schlafende Chunks“), damit auch große Welten flüssig laufen.
- `src/render/`: Canvas-Rendering inklusive Wärmebild
- `src/io/save.ts`: Szenenformat (gzip + base64 in JSON), Speicherplätze im localStorage

In der Browser-Konsole ist die Simulation zum Debuggen unter `window.sandboxy` erreichbar.

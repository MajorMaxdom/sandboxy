# Sandboxy – Projektnotizen

Falling-Sand-Sandbox im Browser (eigene Umsetzung des Genres, keine Kopie von sandspiel/Sandboxels).
TypeScript + Vite, kein Framework, Rendering per Canvas `ImageData`. UI-Texte sind **Deutsch**.
Für Nutzer-Doku siehe `README.md`; diese Datei ist für die Weiterentwicklung.

## Setup auf einer neuen Maschine
```bash
npm install          # Node ≥ 20 (entwickelt mit Node 26), Lockfile ist dabei
npm run dev          # http://localhost:5173, auch im LAN (vite.config: host: true)
npm test             # Vitest, aktuell 84 Tests, alle grün
npm run build        # tsc --noEmit + vite build → dist/ (statisch, überall hostbar)
```
`node_modules/` und `dist/` sind in `.gitignore`. Repo: https://github.com/MajorMaxdom/sandboxy (privat, Branch `main`). Auf neuer Maschine: `git clone` + `npm install`.

## Architektur (Kurzfassung)
- **Raster als Struct-of-Arrays** in `src/sim/simulation.ts`: `type` (Uint8, Element-ID), `temp`, `life` (Uint16, Mehrzweck-Zähler), `charge` (Strom), `shade` (Farbvariante 0–3), `clock` (schon verarbeitet in diesem Tick), `vx/vy` (Geschwindigkeit).
- **Elemente sind Daten** (`ElementDef` in `src/sim/types.ts`), eine Datei pro Kategorie in `src/elements/`. `registry.ts` baut daraus flache Typed Arrays `P.*` (in `props.ts`) und eine Reaktionstabelle `P.reactTable[a*n+b]`. Reaktionen werden automatisch gespiegelt.
- **`ids.ts` / `props.ts`** sind getrennt von `registry.ts`, um zyklische Imports zu vermeiden: Element-Dateien importieren nur `ID` und `P`, nie die Registry.
- **Tick** (`Simulation.step`): Zellen von unten nach oben (Richtung pro Zeile abwechselnd) → `updateCell` (Lebensdauer → Explosion → Strahlung → Reaktion → Wind → Element-`update` → Brennen → Bewegung) → Temperatur → Strom → Luft.
- **Schlafende Chunks** (16×16): Nur Blöcke, in denen sich etwas tut, werden verarbeitet. `swap/transform/spawn` wecken automatisch. Wer Arrays direkt beschreibt, muss `sim.wake(i)` bzw. `sim.wakeAll()` aufrufen. „Unruhige“ Elemente (Gase, Lebensdauer, `update`, radioaktiv) halten ihren Block wach.
- **Systeme:** `movement.ts` (Pulver/Flüssig/Gas + ballistischer Flug), `temperature.ts` (Diffusion + Phasenübergänge), `reactions.ts` (Reaktionen, Brennen), `electricity.ts` (Impulse, Schalter-Gating), `explosion.ts`, `radiation.ts` (Strahlungsteilchen, Spaltung, Atomexplosion, `signal()`/`pulse()` für Logik), `wind.ts` (globaler Wind, Gebläse-Strahl), `air.ts` (Druck/Strömung auf **2×2-grobem** Raster, `sim.airIndex(x,y)`).
- **UI:** `main.ts` (Loop, Layout/Pixelgröße, Tastatur, Formen-Werkzeuge), `ui/toolbar.ts`, `ui/saves.ts` (Szenen-Dialog), `ui/history.ts` (Undo/Redo per Snapshot), `render/renderer.ts` (Normal/Wärme/Druck + Overlay), `input/pointer.ts`.
- **IO:** `io/save.ts` (gzip+base64-JSON mit Elementnamen → robust gegen Umsortierung), `io/share.ts` (Szene im URL-Hash `#s=`), `io/demos.ts` (8 Demo-Szenen per Code).

## Konventionen und Stolperfallen
- **Doppelt belegte Felder:** `life` ist Lebensdauer, Wachstumsbudget, Schalterzustand, Klon-ID, Kritikalität usw. `shade` speichert bei Strahlung die **Flugrichtung 0–7**, deshalb rendert der Renderer mit `shade & 3`, und `clear()` setzt `shade` zurück.
- **Signale von Logik-Bausteinen** setzen `charge = CHARGE_MAX + 1`, damit jeder Leser den Puls genau einmal als `charge === CHARGE_MAX` sieht, unabhängig von der Reihenfolge.
- **Temperatur bei Umwandlungen:** `transform()` hebt heiße Produkte auf ihre `defaultTemp` an (bzw. senkt kalte), Phasenübergänge nutzen `keepTemp = true`.
- **Demos** bauen in Bruchteil-Koordinaten. Vorsicht vor Rundungslücken von einer Pixelzeile zwischen Bauteilen, die sich berühren müssen. Dafür gibt es Tests in `tests/features.test.ts` („demo behaviour“).
- **Balancing-Werte** (kritische Masse, Brenngeschwindigkeiten, Gebläsedruck) wurden per Experiment/Test eingestellt. Nach Änderungen `npm test` laufen lassen.
- **Neues Element:** Objekt in passender `src/elements/*.ts` ergänzen. Verweise per Key-String, die Registry wirft bei Tippfehlern. Neue Kategorie: `Category` in `types.ts` + `CATEGORIES` in `registry.ts`.
- **Debuggen im Browser:** `window.sandboxy` = `{ sim, ELEMENTS, ID }`.

## Stand (01.11.2026)
**Fertig:**
- 98 malbare Elemente (plus 10 interne wie Strahlung, Rakete, Rost) in 12 Kategorien: Land, Feststoffe, Metalle, Flüssigkeiten, Gase, Energie, Technik, Logik, Strahlung, Leben, Sprengstoffe, Spezial, dazu der Tab Werkzeuge.
- Temperatur, Strom, Wind, Luftdruck, Strahlung mit kritischer Masse, Geschwindigkeit/Trümmer und Mutationen.
- Pixelgröße 1–12 px, Touch-Bedienung, Werkzeuge Linie/Rechteck/Füllen/Pipette, Undo/Redo.
- Speichern/Laden, Teilen-Link und Demo-Szenen.

**Bekannte Einschränkungen:**
- Logik-Gatter zeigen nur nach rechts.
- Durch das grobe Luft-Raster lassen Spalte von unter 3 Pixeln kaum Luft durch.
- Solange globaler Wind ≠ 0 ist, schläft kein Chunk (kostet Leistung bei kleinen Pixeln).
- Sehr volle Szenen ergeben lange Teilen-Links.

**Offene Ideen (noch nicht umgesetzt):**
- Tag/Nacht und Wetter (Punkt 5 der ursprünglichen Liste).
- Gatter in alle Richtungen, weitere Gatter (ODER, XOR, Flipflop).
- Mehr Demos, Partikel-Infofenster.

## Verifikation
- `npm test` muss grün sein, `npm run build` ohne Fehler.
- Visuelle Checks liefen per Playwright (`playwright-core` mit lokalem Chrome, `channel: 'chrome'`) gegen `npx vite preview --port 4173`. Die Skripte lagen nur im temporären Scratchpad und sind nicht im Repo.

# Sandboxy – Projektnotizen

Falling-Sand-Sandbox im Browser (eigene Umsetzung des Genres, keine Kopie von sandspiel/Sandboxels).
TypeScript + Vite, kein Framework, Rendering per Canvas `ImageData`. UI-Texte sind **Deutsch**.
Für Nutzer-Doku siehe `README.md`; diese Datei ist für die Weiterentwicklung.

## Setup auf einer neuen Maschine
```bash
npm install          # Node ≥ 20 (entwickelt mit Node 26), Lockfile ist dabei
npm run dev          # http://localhost:5173, auch im LAN (vite.config: host: true)
npm test             # Vitest, aktuell 144 Tests, alle grün
npm run build        # tsc --noEmit + vite build → dist/ (statisch, überall hostbar)
```
`node_modules/` und `dist/` sind in `.gitignore`. Repo: https://github.com/MajorMaxdom/sandboxy (privat, Branch `main`). Auf neuer Maschine: `git clone` + `npm install`.

## Architektur (Kurzfassung)
- **Raster als Struct-of-Arrays** in `src/sim/simulation.ts`: `type` (Uint8, Element-ID), `temp`, `life` (Uint16, Mehrzweck-Zähler), `charge` (Strom), `shade` (Farbvariante 0–3), `clock` (schon verarbeitet in diesem Tick), `vx/vy` (Geschwindigkeit).
- **Elemente sind Daten** (`ElementDef` in `src/sim/types.ts`), eine Datei pro Kategorie in `src/elements/`. `registry.ts` baut daraus flache Typed Arrays `P.*` (in `props.ts`) und eine Reaktionstabelle `P.reactTable[a*n+b]`. Reaktionen werden automatisch gespiegelt.
- **`ids.ts` / `props.ts`** sind getrennt von `registry.ts`, um zyklische Imports zu vermeiden: Element-Dateien importieren nur `ID` und `P`, nie die Registry.
- **Tick** (`Simulation.step`): Zellen von unten nach oben (Richtung pro Zeile und Tick per Hash zufällig, nicht abwechselnd, sonst entstehen Streifen an Hängen) → `updateCell` (Lebensdauer → Explosion → Strahlung → Reaktion → Wind → Element-`update` → Brennen → Bewegung) → Temperatur → Strom → Luft.
- **Schlafende Chunks** (16×16): Nur Blöcke, in denen sich etwas tut, werden verarbeitet. `swap/transform/spawn` wecken automatisch. Wer Arrays direkt beschreibt, muss `sim.wake(i)` bzw. `sim.wakeAll()` aufrufen. „Unruhige“ Elemente (Gase, Lebensdauer, `update`, radioaktiv) halten ihren Block wach. Bei globalem Wind bleibt nur wach, was der Wind in eine freie Nachbarzelle schieben kann. Eine Änderung des Windreglers weckt einmal alles.
- **Temperatur überspringt Chunks** (`temperature.ts`), wenn der Block schläft, alle Zellen höchstens 0,5 °C von der Umgebung abweichen und kein Phasenübergang und keine Zündung ansteht. Dafür wird jeder Block jeden Tick kurz gescannt, also dürfen `temp`-Werte ohne `wake()` geschrieben werden. Ein Block läuft auch dann, wenn sein rechter oder unterer Nachbar Wärme braucht, weil jede Zelle nur mit rechts und unten austauscht.
- **Systeme:** `movement.ts` (Pulver/Flüssig/Gas + ballistischer Flug), `temperature.ts` (Diffusion + Phasenübergänge), `reactions.ts` (Reaktionen, Brennen), `electricity.ts` (Impulse, Schalter-Gating), `explosion.ts`, `radiation.ts` (Strahlungsteilchen, Spaltung, Atomexplosion, `signal()`/`pulse()` für Logik), `wind.ts` (globaler Wind, Gebläse-Strahl), `air.ts` (Druck/Strömung auf **2×2-grobem** Raster, `sim.airIndex(x,y)`).
- **UI:** `main.ts` (Loop, Layout/Pixelgröße, Tastatur, Formen-Werkzeuge), `ui/toolbar.ts` (inkl. Optionszeile: Laserfarbe, Feuerwerk-Füllung), `ui/view.ts` (Zoom/Pan per CSS-Transform, Raster bleibt gleich), `ui/saves.ts` (Szenen-Dialog), `ui/history.ts` (Undo/Redo per Snapshot), `render/renderer.ts` (Normal/Wärme/Druck + Overlay), `input/pointer.ts`.
- **Version:** `src/version.ts` (aus `package.json`), Changelog in `CHANGELOG.md`, siehe „Versionierung“.
- **IO:** `io/save.ts` (gzip+base64-JSON mit Elementnamen → robust gegen Umsortierung), `io/share.ts` (Szene im URL-Hash `#s=`), `io/demos.ts` (8 Demo-Szenen per Code).

## Konventionen und Stolperfallen
- **Doppelt belegte Felder:** `life` ist Lebensdauer, Wachstumsbudget, Schalterzustand, Klon-ID, Kritikalität, Laserfarbe (RGB565), Feuerwerk-Füllung (Element-ID; bei der Rakete ab Bit 6, darunter Flugzeit) usw. Element-IDs in `life` müssen in `deserialize` umgemappt werden.
- **Elementoptionen:** `ElementDef.option` ('color' | 'element' | 'level', Letzteres eine Stärke 1–10 wie beim Gebläse) zeigt in der Werkzeugleiste ein Steuerelement (`optionLabel`, `optionDefault`, `optionNone`, gemeinsamer Wert über `optionKey`). Der Wert reist als `Tool.param` mit und landet beim Malen in `life`. Ist `life` 0, gilt `P.defaultParam`. Element-IDs in `life` (`P.lifeIsElement`) werden beim Laden umgemappt.
- **Laserlicht** ist keine Materie: Laser schreiben jeden Tick über `traceBeam()` (tech.ts) in `sim.beam`. Was der Strahl an einer Zelle tut, steht in `ElementDef.light` ('pass', 'mirror/', 'mirror\\', 'filter'); sonst wird er absorbiert und heizt, oder `onLight` wird aufgerufen (Solarzelle, Lichtsensor). Der Strom-Haltezähler von Laser, Wasserhahn und Gebläse liegt in `shade`-Bits 2–7 (`poweredOrUnwired`), weil `life` die Option trägt.
- **Portale:** Ausgänge tragen sich jeden Tick in `sim.portalExitsNext` ein, Eingänge lesen im nächsten Tick `sim.portalExits`. Der Kanal ist die Farbe in `life`.
- **Wachsendes mit `calm: true`** (Gras, Moos, Algen, Konverter) hält seinen Chunk nur per `sim.wake(i)` wach, solange es noch Arbeit hat, damit fertige Wiesen schlafen.
- **Brennen:** `burn()` prüft Nachbarn auf CO₂ (erstickt) und Sauerstoff (schneller und heißer, wird langsam verbraucht).
- **Handy-Menü:** Unter 720 px zeigt die obere Leiste nur `#main-tools`. Der Rest steht in `#menu-panel`, das auf breiten Bildschirmen `display: contents` hat und am Handy als Overlay über der Spielfläche aufklappt (☰, `setMenu()` in `main.ts`). Als Overlay ändert es die Bühnenhöhe nicht.
- **`#app` ist `position: fixed; inset: 0`** statt `100dvh`. Die Statusleiste der Home-Bildschirm-App ist `black`, nicht `black-translucent`: Mit `black-translucent` machte iOS 26 die oberste Leiste unscharf und ließ unten einen leeren Streifen (#7). iOS liest diese Meta-Tags nur beim Hinzufügen zum Home-Bildschirm.
- **Höhe der Werkzeugleiste fix halten:** Ändert sie sich (z. B. durch umbrechenden Beschreibungstext), schrumpft die Bühne und das Raster wird neu angelegt. Deshalb hat `#desc-row` eine feste Höhe.
- **`calm: true`** an einem Element mit `update` verhindert, dass es seinen Chunk dauerhaft wach hält (z. B. Feuerwerk, das nur auf Hitze wartet). `shade` speichert bei Strahlung die **Flugrichtung 0–7**, deshalb rendert der Renderer mit `shade & 3`, und `clear()` setzt `shade` zurück.
- **Signale von Logik-Bausteinen** setzen `charge = CHARGE_MAX + 1`, damit jeder Leser den Puls genau einmal als `charge === CHARGE_MAX` sieht, unabhängig von der Reihenfolge.
- **Hitze-Obergrenzen:** Brennendes heizt brennbare Nachbarn höchstens auf die eigene `burn.heat`, der äußere Explosionsring höchstens auf 2000 °C. Ohne diese Grenzen schaukelten sich Stapel auf über 10.000 °C hoch.
- **Kohle → Glut:** Kohle wird beim Brennen zu `ember` (intern), die 60–120 s bei 1100 °C glüht, Flammen aufsteigen lässt und zu Asche zerfällt. Wasser löscht Glut zurück zu Kohle.
- **Temperatur bei Umwandlungen:** `transform()` hebt heiße Produkte auf ihre `defaultTemp` an (bzw. senkt kalte), Phasenübergänge nutzen `keepTemp = true`.
- **Gas verdrängen:** `swap()` markiert Gas, das Materie gerade zur Seite geschoben hat (`sim.pushed` = `pushStamp`). Solches Gas darf im selben Tick nicht noch einmal verdrängt werden, und Flüssigkeiten tauschen seitwärts nur mit direkt benachbartem Gas, nicht mit Blasen unter einer Flüssigkeit. Verdrängte leere Luft verliert die Hälfte ihrer Überhitze. Ohne das reicht eine Zeile fließendes Öl Flammen und heiße Luft in einem Tick bis an den Rand weiter.
- **Fallen mitziehen:** Fällt ein Teilchen frei, bekommt das gleichartige Teilchen direkt darüber sein Tempo (`dragAlong` in `movement.ts`). Sonst reißen gemalte Ströme in Balken auf, weil jede neue Zeile aus dem Stand startet.
- **Frame-Budget:** `main.ts` simuliert pro Frame höchstens `SIM_BUDGET_MS` lang und verwirft den Rest, statt in eine Abwärtsspirale zu geraten. Die Statuszeile zeigt dann „Tempo … %“.
- **Overlay** (Pinsel, Linien-/Rechteck-Vorschau) wird in den Pixelpuffer gerastert, nicht per Canvas-Pfad gezeichnet. `putImageData` gemischt mit Vektorzeichnen bremst Safari stark aus.
- **Touch auf iOS:** `user-select: none` und `-webkit-touch-callout: none` auf `body` (Textfelder ausgenommen), dazu `preventDefault` auf `touchstart`/`touchmove` am Canvas. Sonst öffnet langes Malen die Lupe. Gemalt wird über Pointer Events, die davon nicht betroffen sind.
- **Home-Bildschirm:** `public/manifest.webmanifest` und die Icons in `public/` (aus dem Pixel-Logo gerendert). Ein Service Worker für Offline-Betrieb fehlt bewusst, weil er HTTPS braucht und das Homelab per HTTP läuft.
- **Demos** bauen in Bruchteil-Koordinaten. Vorsicht vor Rundungslücken von einer Pixelzeile zwischen Bauteilen, die sich berühren müssen. Dafür gibt es Tests in `tests/features.test.ts` („demo behaviour“).
- **Balancing-Werte** (kritische Masse, Brenngeschwindigkeiten, Gebläsedruck) wurden per Experiment/Test eingestellt. Nach Änderungen `npm test` laufen lassen.
- **Neues Element:** Objekt in passender `src/elements/*.ts` ergänzen. Verweise per Key-String, die Registry wirft bei Tippfehlern. Neue Kategorie: `Category` in `types.ts` + `CATEGORIES` in `registry.ts`.
- **Debuggen im Browser:** `window.sandboxy` = `{ sim, ELEMENTS, ID }`.

## Stand (02.11.2026)
**Fertig:**
- 131 malbare Elemente (plus 14 interne wie Strahlung, Rakete, Rost, Glut, blaue Flamme, Spinnennetz) in 12 Kategorien: Land, Feststoffe, Metalle, Flüssigkeiten, Gase, Energie, Technik, Logik, Strahlung, Leben, Sprengstoffe, Spezial, dazu der Tab Werkzeuge.
- Temperatur, Strom, Wind, Luftdruck, Strahlung mit kritischer Masse, Geschwindigkeit/Trümmer und Mutationen.
- Pixelgröße 1–12 px, Touch-Bedienung, Werkzeuge Linie/Rechteck/Füllen/Pipette, Undo/Redo.
- Speichern/Laden, Teilen-Link und Demo-Szenen.

**Bekannte Einschränkungen:**
- Logik-Gatter zeigen nur nach rechts.
- Durch das grobe Luft-Raster lassen Spalte von unter 3 Pixeln kaum Luft durch.
- Viel gleichzeitig fallende Flüssigkeit ist teuer (~40 ms/Tick bei 800×500 voll Wasser), das ist echte Bewegungsarbeit.
- Sehr volle Szenen ergeben lange Teilen-Links.

**Offene Ideen (noch nicht umgesetzt):**
- Tag/Nacht und Wetter (Punkt 5 der ursprünglichen Liste).
- Gatter in alle Richtungen.
- Mehr Demos, Partikel-Infofenster.

## Versionierung
- Version steht **nur** in `package.json`. `vite.config.ts` reicht sie als `__APP_VERSION__` durch (`src/version.ts`). Angezeigt wird sie in der Kopfzeile und im Szenen-Dialog, außerdem landet sie als `appVersion` in Speicherdateien.
- SemVer: **Minor** für neue Elemente oder Funktionen, **Patch** für reine Fehlerkorrekturen. Das Szenenformat `v: 1` ist davon unabhängig und ändert sich nur, wenn alte Dateien nicht mehr wie bisher lesbar sind.
- **Bei jeder Änderung:** Eintrag in `CHANGELOG.md` unter „Unveröffentlicht“.
- **Release:** Version mit `npm pkg set version=X.Y.Z && npm install --package-lock-only` setzen, im Changelog „Unveröffentlicht“ in `[X.Y.Z] – Datum` umbenennen und die Vergleichslinks unten anpassen. Dann committen, mit `git tag -a vX.Y.Z -m "Sandboxy X.Y.Z"` taggen und mit `git push --follow-tags` pushen.
- Git-Identität im Repo: `MajorMaxdom <57041850+MajorMaxdom@users.noreply.github.com>`, nie der echte Name.

## Verifikation
- `npm test` muss grün sein, `npm run build` ohne Fehler.
- Visuelle Checks liefen per Playwright (`playwright-core` mit lokalem Chrome, `channel: 'chrome'`) gegen `npx vite preview --port 4173`. Die Skripte lagen nur im temporären Scratchpad und sind nicht im Repo.

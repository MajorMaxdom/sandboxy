# Changelog

Alle nennenswerten Änderungen an Sandboxy. Versionen folgen [Semantic Versioning](https://semver.org/lang/de/):
**Minor** (0.x.0) für neue Elemente und Funktionen, **Patch** (0.x.y) für reine Fehlerkorrekturen.
Jede Version hat ein Git-Tag `vX.Y.Z`.

## [Unveröffentlicht]

## [0.8.0] – 2026-11-03

### Neu
- **Wind-Werkzeug:** Im Tab „Werkzeuge“ wischt man über die Fläche und bläst Gase, Staub und Leichtes in Wischrichtung. Je schneller der Wisch, desto stärker der Stoß, und er klingt über einige Ticks aus. Wände und Metall bleiben stehen.

### Geändert
- Der Tab „Werkzeuge“ (Radierer, Heizen, Kühlen, Wind, Schalter) steht jetzt vorne. Am Handy war er als letzter Tab leicht zu übersehen.

## [0.7.0] – 2026-11-03

### Neu
- **Gebläse saugen an und sind durchlässig:** Hinter einem Gebläse entsteht ein kürzerer Sog (gut ein Drittel der Reichweite). Was der Wind von hinten in das Gebläse drückt, kommt vorne wieder heraus, auch durch dicke Gebläse-Flächen. Das gilt für Gase und leichte Teilchen wie Asche oder Schnee. Sand, Wasser und Feststoffe bleiben liegen, von der Seite und von vorne ist ein Gebläse weiterhin eine Wand.

### Behoben
- Hinter Gebläsen sammelten sich Gase: Der Unterdruck saugte sie an, aber durch das Gebläse kamen sie nicht hindurch.

## [0.6.0] – 2026-11-03

### Neu
- **Gebläse-Stärke (#8):** Unter der Palette lässt sich die Stärke 1–10 einstellen (Standard 5 = wie bisher). Mit der Stärke wachsen Reichweite (20–65 Zellen), Windkraft und Luftdruck. Übermalen stellt vorhandene Gebläse um, die Pipette übernimmt die Stärke.

### Geändert
- Starker Wind trägt leichte Teilchen bis zu 3 Zellen pro Tick statt einer.
- Gas, das gegen eine Wand geblasen wird, weicht seitlich aus. Aufsteigende Gase klettern bevorzugt an der Wand nach oben, statt sich in der Ecke zu stauen.
- Am iPhone reicht die Palettenleiste in ihrer Farbe bis unter den Home-Balken.

## [0.5.2] – 2026-11-03

### Behoben
- **Home-Bildschirm-App am iPhone (#7):** Die Statusleiste ist jetzt undurchsichtig (`black` statt `black-translucent`), die App beginnt unter ihr. Bisher lief die App unter die Statusleiste. iOS 26 machte dadurch die erste Werkzeugzeile unscharf und gab der App eine zu kleine Höhe, unten blieb ein leerer Streifen. Wirkt erst, nachdem die App neu zum Home-Bildschirm hinzugefügt wurde.

## [0.5.1] – 2026-11-03

### Behoben
- **Geigerzähler (#6):** Ein Treffer ließ nur das eine getroffene Pixel für 8 Ticks aufblinken, ein gemalter Zähler blieb also praktisch dunkel. Jetzt leuchtet der ganze zusammenhängende Zähler etwa eine Drittelsekunde lang auf. Jede seiner Zellen gibt den Stromimpuls an angrenzende Leiter ab, ein Kabel kann also an jeder Seite angeschlossen sein. Getrennte Zähler bleiben unabhängig.

## [0.5.0] – 2026-11-03

### Geändert
- **Handy-Layout (#5):** Die obere Leiste ist nur noch eine Zeile mit Pause, Einzelschritt, Rückgängig, Wiederholen, Werkzeugform und einem ☰-Menü. Darin liegen nach Bereichen sortiert Tempo, Wind, Pinsel, Übermalen, Ansicht, Pixelgröße, Leeren und Szenen. Das Menü öffnet sich über der Spielfläche, das Raster bleibt dabei gleich. Ein Tipp daneben schließt es, ohne zu malen. Die Spielfläche wird dadurch etwa 120 px höher.

### Behoben
- Als Home-Bildschirm-App blieb am iPhone unten ein leerer Streifen, weil iOS dort eine zu kleine Bildschirmhöhe meldet.

## [0.4.2] – 2026-11-03

### Geändert
- Die Version steht jetzt auch in der Statuszeile über der Spielfläche, also auch am Handy sichtbar.

### Behoben
- Öl fing an mehreren Stellen gleichzeitig Feuer, oft an den Rändern, statt nur dort, wo die Hitze ankam. Seitwärts fließendes Öl tauschte den Platz mit Flammen und heißer Luft bis zu 3 Zellen weit, und eine ganze Zeile Öl reichte sie so in einem Tick bis an den Rand weiter. Jetzt wird Gas pro Tick nur einmal und nur um eine Zelle verdrängt, und verdrängte Luft kühlt dabei ab.
- Dampfblasen im Wasser wurden vom fließenden Wasser seitlich geschoben statt aufzusteigen.

## [0.4.1] – 2026-11-03

### Behoben
- Streifen an rutschenden Hängen aus Sand, Wasser und anderem (#3, #4): Die Zeilen wurden abwechselnd links- und rechtsherum abgearbeitet. Eine Zeile gegen die Fließrichtung rückt dabei als Ganzes nach, eine in Fließrichtung nur an der Spitze. Deshalb wechselten sich lange und kurze Zeilen ab, und Wasser hing streifenweise über Luft. Die Richtung ist jetzt pro Zeile und Tick zufällig.

## [0.4.0] – 2026-11-03

### Neu
- **Zum Home-Bildschirm hinzufügen:** App-Icon, Name und Vollbild ohne Browserleisten (Web-App-Manifest und Apple-Meta-Tags).

### Behoben
- Langes Drücken beim Malen öffnete auf dem iPhone die Lupe bzw. die Textauswahl.

## [0.3.1] – 2026-11-03

### Behoben
- Fallendes Wasser, Sand usw. riss beim Malen in waagerechte Balken auf: Jede neue Zeile fiel aus dem Stand los, während die darunter schon schnell war. Teilchen nehmen jetzt das Tempo des Teilchens unter ihnen mit, der Strahl bleibt geschlossen (#2).
- Ruckeln auf dem iPhone (#1): Die Pinsel-Vorschau wird direkt ins Pixelbild gezeichnet statt per Canvas-Pfad, was Safari jeden Frame ausgebremst hat. Kommt das Gerät nicht hinterher, läuft die Simulation langsamer, statt die Bildrate einbrechen zu lassen. Die Anzeige oben zeigt dann „Tempo … %“.

## [0.3.0] – 2026-11-02

### Neu
- **Licht:** Spiegel ╱ und ╲, Farbfilter (lässt nur seine Farbe durch, Weiß wird farbig), Solarzelle (Strom aus Laserlicht), Lichtsensor (Lichtschranke).
- **Feuer und Chemie:** Sauerstoff (Flammen laufen hindurch, Feuer brennt schneller und heißer), CO₂ (sinkt, erstickt Feuer und Glut, Pflanzen machen daraus Sauerstoff), Lauge (neutralisiert Säure, zersetzt Pflanzen und Aluminium), Alkohol (blaue Flamme, mischt sich mit Wasser), Wachs (schmilzt bei 60 °C).
- **Feststoffe und Flüssigkeiten:** Ton (wird im Feuer zu Ziegel), Gummi (isoliert, säurefest), Papier (brennt sehr schnell), Honig (sehr zähflüssig).
- **Technik und Logik:** ODER-, XOR-Gatter, Flipflop, Wasserhahn mit wählbarem Element, Förderbänder ← →.
- **Leben:** Gras (wächst über Erde), Moos (überwächst feuchten Stein), Algen (wachsen im Wasser, Fische fressen sie), Spinne mit Netz.
- **Spezial:** Schwarzes Loch, Antimaterie, Konverter mit wählbarem Zielelement, Portal-Paare mit Kanalfarbe.

### Geändert
- Element-Einstellungen (Farbe, Füllung, Kanal …) werden pro Element gemerkt. Alle Laser teilen sich eine Farbe, Portal-Eingang und -Ausgang ihren Kanal.

## [0.2.0] – 2026-11-02

### Neu
- **Laser** in 4 Richtungen (Technik) mit frei wählbarer Farbe. Der Strahl erhitzt, was er trifft, und geht durch Glas. Mit Kabel leuchtet er nur unter Strom. Übermalen mit anderer Farbe färbt um, die Pipette übernimmt die Farbe.
- **Feuerwerk mit Füllung:** Unter der Palette ein Element wählen, in das die Rakete zerplatzt.
- **Zoom** per Mausrad (zur Mausposition), Ansicht ziehen mit mittlerer Maustaste, `0` setzt zurück, Zwei-Finger-Zoom am Handy. Die Rastergröße bleibt dabei gleich.
- **Pinselgröße** per Umschalt+Mausrad.
- **Kohle** wird beim Brennen zu Glut, die etwa 2 Minuten bei 1100 °C glüht. Wasser löscht sie.
- Versionsanzeige in der Kopfzeile und im Szenen-Dialog. Gespeicherte Szenen vermerken die Version.

### Geändert
- Pipette nur noch per Alt+Klick (die mittlere Maustaste verschiebt jetzt die Ansicht).
- **Leistung:** Globaler Wind hält nur noch Partikel wach, die er bewegen kann (bei 800×500 von 38 auf 1,5 ms pro Tick). Temperatur, Strom und Haupt-Durchlauf überspringen ruhende Bereiche, ruhige Szenen kosten etwa ein Drittel.

### Behoben
- Brennende Stapel und Explosions-Ketten heizten sich unbegrenzt auf (bis über 30.000 °C).
- Die obere Leiste lief am Handy rechts über den Rand.
- Wechselte man das Werkzeug, konnte die Werkzeugleiste ihre Höhe ändern. Dadurch wurde das Raster neu angelegt und die Szene verrutschte.

## [0.1.0] – 2026-11-01

Erste Version: 98 Elemente in 12 Kategorien, Temperatur, Strom und Logik, Wind, Luftdruck, Strahlung mit kritischer Masse, Leben, Undo/Redo, Speichern, Teilen-Link und 8 Demo-Szenen.

[Unveröffentlicht]: https://github.com/MajorMaxdom/sandboxy/compare/v0.8.0...HEAD
[0.8.0]: https://github.com/MajorMaxdom/sandboxy/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/MajorMaxdom/sandboxy/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/MajorMaxdom/sandboxy/compare/v0.5.2...v0.6.0
[0.5.2]: https://github.com/MajorMaxdom/sandboxy/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/MajorMaxdom/sandboxy/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/MajorMaxdom/sandboxy/compare/v0.4.2...v0.5.0
[0.4.2]: https://github.com/MajorMaxdom/sandboxy/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/MajorMaxdom/sandboxy/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/MajorMaxdom/sandboxy/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/MajorMaxdom/sandboxy/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/MajorMaxdom/sandboxy/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/MajorMaxdom/sandboxy/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/MajorMaxdom/sandboxy/releases/tag/v0.1.0

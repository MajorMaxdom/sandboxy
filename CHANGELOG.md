# Changelog

Alle nennenswerten Änderungen an Sandboxy. Versionen folgen [Semantic Versioning](https://semver.org/lang/de/):
**Minor** (0.x.0) für neue Elemente und Funktionen, **Patch** (0.x.y) für reine Fehlerkorrekturen.
Jede Version hat ein Git-Tag `vX.Y.Z`.

## [Unveröffentlicht]

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

[Unveröffentlicht]: https://github.com/MajorMaxdom/sandboxy/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/MajorMaxdom/sandboxy/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/MajorMaxdom/sandboxy/releases/tag/v0.1.0

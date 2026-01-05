# Candy Rush (demo)

Open [index.html](index.html) in a browser to play a small Candy Crush–style demo.

- Drag a candy onto an adjacent candy to swap.
- Match 3 or more in a row/column to clear and score points.
- Click the Restart button to shuffle/reset the board.

This is a simple single-file demo (HTML/CSS/JS) intended to run statically—no build steps required.

## Sound

The demo supports simple sound effects. Place audio files (WAV/MP3/OGG) under `assets/sounds/` with these filenames:

- `swap.wav` — played when tiles are swapped
- `match.wav` — played when matched tiles are cleared
- `bump.wav` — played when a swap doesn't produce a match
- `restart.wav` — played when clicking Restart
- `select.wav` — played when selecting a tile

Use the volume slider and mute button in the HUD to control audio. Volume state is persisted in `localStorage`.

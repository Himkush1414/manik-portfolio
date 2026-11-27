# Games library QA

Build first (`node node_modules/vite/bin/vite.js build` with Windows node), serve `dist/` (e.g.
`python3 -m http.server 4182 --directory dist`), then run with Windows node + installed Chrome:

    cmd.exe /c "set PLAYWRIGHT_BROWSERS_PATH=& node games/qa/games-shots.mjs http://localhost:4182/ <outDir> <mode>"

| mode | what it checks |
|---|---|
| `views [WxH,...]` | 9 viewports x 2 games: no horizontal scroll, Play never covered by the nav, legal row clears the nav, touch targets >= 44 px, console errors |
| `keys` | Tab order, arrows / Home / End switch games (cross-fade 400 ms, 150 ms reduced motion), Enter plays, Esc returns focus to Play |
| `player [WxH]` | Play -> fullscreen dialog; Esc, Back, Exit each close it, remove the iframe, release the history entry, restore focus |
| `rotate` | phone portrait: rotate overlay and no game; landscape: game starts; portrait again: paused |
| `demo [WxH]` | the space game played through the player to the ejection: end card, Replay (new document), Exit |
| `demo-back` | the same, leaving through "Back to library" |
| `cutoff` | the game alone with its debug API: `?demo=eject` stops at `mission.launching`, the standalone route reaches `mission.playing` |
| `qr` | QR tiles (decode the PNGs with jsQR), Android block, Play opens a new tab |
| `embed` | only against a QA build with Mindtier `embeddable: true`: the portrait frame player |
| `nav` | Skills & Fun "Game" box -> /games (same tab), every nav link on /games resolves, title / meta |

`contact-compare.mjs shoot|diff` proves the Contact view is unchanged (orb + clocks masked; compare a
run against a second run of the same build for the noise floor). Evidence per stage: `screens/stage-N`.

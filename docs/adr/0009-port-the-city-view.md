# ADR 0009: Port the Mac HUD's City view instead of redrawing it
**Status:** accepted
**Decision.** `web/src/city/city-state.js` and `scene.js` are the upstream reducer and canvas renderer (all pixel art is drawn in code), changed for the new cast and AWS events; panels and bars are React.
**Consequences.** Same look as the owner's screenshot; the reducer stays unit-testable in Node. The ported files are excluded from ESLint/Prettier to keep them diffable against upstream.

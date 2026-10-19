# Aedon AI — Marketing site (`front_face`)

Public website for the Aedon AI voice-agent platform. Angular 19 (standalone components, signals), plain CSS with global tokens, Font Awesome icons. **No backend** — all content is static and the demo form uses a mock service.

```bash
npm install
npm start          # http://localhost:4200
npm run build      # dist/front_face
```

## Structure

```
src/
  styles/variables.css   design tokens (dark default, light overrides via [data-theme])
  styles/globals.css     shared utility classes (.btn, .card, .grid-*, .chip, .reveal…)
  app/
    core/                models, ThemeService, DemoRequestService (mock submit)
    data/                all static content: solutions + conversation scripts, features, pricing, FAQs
    shared/              navbar, footer, call simulator, CTA banner, FAQ list, voice wave, reveal directive
    pages/               home, solutions, solution-detail, platform, pricing, contact, not-found
```

To edit copy, pricing or the sample calls, change the files in `src/app/data/` — no component changes needed.

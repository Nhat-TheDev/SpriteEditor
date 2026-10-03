# Sprite Editor

A pixel-art and sprite-animation editor that runs entirely in the browser. Draw frame by frame, preview the animation, and export a PNG or a full spritesheet — no server, no account, no upload.

## Features

- **Tools** — Pencil, Eraser, Line, Rectangle, Ellipse, Fill, Eyedropper, Move, Lasso (select, move, scale, rotate).
- **Layers** — per-layer visibility and opacity, with active-layer targeting.
- **Timeline** — add/duplicate/delete/reorder frames, set FPS, play the animation, and toggle onion skinning.
- **Symmetry drawing** — mirror strokes across the X axis, Y axis, or both. Applies to drawing tools only, never to Eyedropper, Move, or Lasso.
- **History** — full-state undo/redo, capped at 50 snapshots.
- **Panels** — colour picker with palettes, plus a project/history panel.
- **Import / export** — save and reopen projects as `.json`, export the current frame as PNG, or export every frame as one spritesheet PNG (pixels are preserved 1:1, never rescaled).
- **Autosave** — the working project is written to `localStorage` every 5 minutes when there are unsaved changes.

## Tech

Next.js (App Router) + React + TypeScript, Zustand for state, Tailwind CSS v4 for styling, Vitest for unit tests. Pixel logic lives in pure functions under `lib/canvas` and `lib/file`; React components under `components/editor` only wire UI events to store actions.

## Getting started

Requires Node 22 (see `.nvmrc`).

```bash
npm install
npm run dev     # http://localhost:3000
```

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npx tsc --noEmit` | Typecheck |

## Deploy to Vercel

The app is fully client-side, so Vercel needs no environment variables and no backend configuration. Either approach works:

### Option A — Git integration (recommended)

1. Push this branch to GitHub.
2. In [vercel.com/new](https://vercel.com/new), import the repository. Vercel detects Next.js and fills in the build settings automatically (`npm run build`, output `.next`).
3. Click **Deploy**. Every push to the default branch then deploys automatically, and other branches get preview URLs.

### Option B — Vercel CLI

```bash
npx vercel login
npx vercel          # preview deployment
npx vercel --prod   # production deployment
```

The CLI writes a `.vercel` directory linking the project to your account; it is already git-ignored, so it stays local.

### Optional environment variable

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public origin (e.g. `https://your-app.vercel.app`) used for canonical and Open Graph URLs. Not required — on Vercel the build falls back to the automatic production domain. |
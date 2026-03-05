# Frontend CSS Architecture

## Goals

- Keep stylesheet context small for safe LLM edits.
- Reduce selector conflicts by using BEM naming for new code.
- Move toward utility-first styling with Tailwind.
- Eliminate dead CSS during production builds with PurgeCSS.

## File structure

- Entry: `assets/css/styles.css`
- Site baseline: `assets/css/site.css`
- Tokens: `assets/css/tokens.css`
- Base: `assets/css/base.css`
- Components: `assets/css/components/*.css`
- Tailwind input: `assets/css/tailwind.input.css`
- Tailwind output: `assets/css/tailwind.generated.css`

## Naming rules for new styles

- Use BEM classes only:
  - Block: `.backend-login`
  - Element: `.backend-login__button`
  - Modifier: `.backend-login--deferred`
- Do not add new ID selectors for styling.
- Keep selector specificity low; prefer one class selector over descendant chains.

## Build pipeline

From `frontend/`:

```bash
npm install
npm run css:dev
npm run css:build
```

Production build uses PostCSS + Tailwind + PurgeCSS and writes:

- `assets/css/tailwind.generated.css`

## Migration policy

- New UI work must go into modular files under `assets/css/components/`.
- Keep shared constants in `tokens.css` and global defaults in `base.css`.

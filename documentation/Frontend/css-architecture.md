# Frontend CSS Architecture

## Goals

- Keep stylesheet context small for safe LLM edits.
- Reduce selector conflicts by using BEM naming for new code.
- Keep one styling system only: shared CSS modules + centralized tokens.

## File structure

- Entry: `shared/css/styles.css`
- Site baseline: `shared/css/site.css`
- Tokens: `shared/css/tokens.css`
- Base: `shared/css/base.css`
- Utilities: `shared/css/utilities.css`
- Components: `shared/css/components/*.css`
- Page-scoped styles: `shared/css/pages/*.css`

## Naming rules for new styles

- Use BEM classes only:
  - Block: `.backend-login`
  - Element: `.backend-login__button`
  - Modifier: `.backend-login--deferred`
- Do not add new ID selectors for styling.
- Keep selector specificity low; prefer one class selector over descendant chains.

## Migration policy

- New UI work must go into modular files under `shared/css/components/`.
- Page-specific overrides belong in `shared/css/pages/`.
- Keep shared constants in `tokens.css` and global defaults in `base.css`.
- Put repeated spacing/title/visibility helpers in `utilities.css` instead of inline `style=""`.

# Generated API contract and docs

This directory is generated from the CUE model (`model/`) by `tools/generator/generate_mobile_contract_artifacts.rb`. Do not edit these files by hand.

- **openapi.yaml** – OpenAPI 3.1 specification (source of truth for mobile and frontend clients).
- **mobile-api.meta.json** – Generator metadata (endpoints, catalogs, version).
- **redoc.html** – API documentation rendered with [Redoc](https://redoc.ly/).

## Viewing the API docs

Serve this directory over HTTP so `openapi.yaml` can be loaded (e.g. CORS when opening the HTML from file is restricted). From the project root:

```bash
npx serve api/generated
```

Then open http://localhost:3000/redoc.html (or the port shown). Alternatively, use any static server (Python `http.server`, Ruby `rackup`, etc.) pointed at `api/generated`.

# RORO Fleet

RORO Fleet is a React-based fleet operations dashboard with a Python FastAPI backend and one PostgreSQL database.

## Project Structure

```text
roro-fleet/
  src/
    index.js                    # React application entrypoint
    frontend/                   # Front end application code
      App.jsx                   # Main authenticated shell and navigation
      components/               # Fleet, vessel, port, report, emissions, P&L views
      hooks/                    # React hooks and auth provider
      pages/                    # Route-level screens such as login
      styles/                   # Global CSS
    backend/                    # Browser-safe frontend service helpers
      services/
        aiAdapters.js           # Disabled placeholder for future AI adapters
  public/                       # Static public assets used by React
  backend/                      # FastAPI backend
    app/
      api/                      # HTTP routes
      repositories/             # PostgreSQL data access
      core/                     # configuration
  deploy/                       # Local deployment and serving helpers
    serve-build.js              # Node static server for the production build
    vessel-lookup.js            # Server-side public AIS vessel detail lookup
    run-dev.cmd                 # Windows helper for local development
    run-build-server.cmd        # Windows helper for serving the built app
    postgresql-core-schema.sql   # PostgreSQL schema
  docs/
    postgres-data-architecture.md # Backend persistence notes
  build/                        # Generated production build output
```

## Front End

Frontend code lives in `src/frontend`.

- `components/` contains dashboard modules such as fleet overview, vessel detail, port rotation, noon reports, bunkering, emissions, and charter P&L.
- `pages/` contains full-page screens.
- `hooks/useAuth.js` owns React auth context and calls the backend Supabase service.
- `styles/global.css` contains shared styling.

The React entrypoint remains at `src/index.js` so Create React App can continue to build the project without extra configuration.

## Backend

The backend API lives in `backend/app` and is served by FastAPI.

- `backend/app/main.py` creates the FastAPI app.
- `backend/app/api/` contains HTTP route modules.
- `backend/app/repositories/` contains PostgreSQL data access.
- `aiAdapters.js` is a disabled placeholder for future server-side AI integrations.
- `vesselLookup.js` calls the local `/api/vessel-lookup` endpoint used by Add Vessel.

Required backend environment variables are read from `.env`:

```text
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/roro_fleet
```

Never put PostgreSQL credentials in `REACT_APP_*` variables. Those are bundled into the browser.

Create backend tables with `deploy/postgresql-core-schema.sql`. See `docs/postgres-data-architecture.md` for the data flow and migration notes.

## Deploy

Deployment helpers live in `deploy`.

- `npm run build` creates the production bundle in `build/`.
- `npm run serve:build` serves the generated `build/` folder locally with `deploy/serve-build.js`.
- `deploy/serve-build.js` also exposes `GET /api/vessel-lookup?q=<name-or-imo>` for server-side public AIS page lookup.
- `deploy/run-dev.cmd` starts the development server on Windows and writes logs to the repo root.
- `deploy/run-build-server.cmd` serves the production build on Windows and writes logs to the repo root.

The build server uses:

```text
HOST=127.0.0.1
PORT=3000
```

Override those environment variables before running the server if another host or port is needed.

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm start
```

Build for production:

```bash
npm run build
```

Serve the production build locally:

```bash
npm run serve:build
```

Run tests:

```bash
npm test
```

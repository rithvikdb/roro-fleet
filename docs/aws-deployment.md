# RORO Fleet AWS Deployment

This app has three deployable parts:

- React frontend: static files from `npm run build`
- FastAPI backend: `backend.app.main:app`
- PostgreSQL database: schema in `deploy/postgresql-core-schema.sql`

## 1. Create The Git Repository

```powershell
git status
git add .
git commit -m "Prepare RORO Fleet for AWS testing"
```

### Option A: AWS CodeCommit

```powershell
aws configure
.\deploy\create-codecommit-repo.ps1 -RepositoryName roro-fleet -Region us-east-1
```

The script creates the CodeCommit repository if it does not exist, sets `origin`, and pushes `main`.

### Option B: GitHub

Create an empty GitHub repository, then connect this local repo:

```powershell
git remote add github https://github.com/<org-or-user>/roro-fleet.git
git push -u github main
```

## 2. Create PostgreSQL On AWS

Use Amazon RDS PostgreSQL.

1. Open AWS Console > RDS > Create database.
2. Choose PostgreSQL.
3. For testing, choose a small burstable instance.
4. Create database name `roro_fleet`.
5. Store the generated username, password, host, and port.
6. In the RDS security group, allow inbound PostgreSQL `5432` from the backend service security group only.

Apply the schema from a machine that can reach RDS:

```powershell
psql "postgresql://<user>:<password>@<rds-host>:5432/roro_fleet" -f deploy/postgresql-core-schema.sql
```

## 3. Deploy The Backend

Recommended testing service: AWS App Runner.

1. AWS Console > App Runner > Create service.
2. Source: GitHub repository.
3. Runtime: Python 3.
4. Build command:

```bash
pip install -r requirements.txt
```

5. Start command:

```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

6. Set environment variables:

```text
DATABASE_URL=postgresql://<user>:<password>@<rds-host>:5432/roro_fleet
SESSION_COOKIE_NAME=roro_session
SESSION_DAYS=14
CORS_ORIGINS=https://<frontend-domain>
```

After deploy, confirm:

```text
https://<backend-service-url>/api/health
```

## 4. Deploy The Frontend

Recommended testing service: AWS Amplify Hosting.

1. AWS Console > Amplify > Host web app.
2. Connect the same GitHub repo.
3. App root: repository root.
4. Build settings:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: build
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

5. Add Amplify environment variable:

```text
REACT_APP_API_BASE_URL=https://<backend-service-url>
```

6. Redeploy frontend after setting the variable.

## 5. Final Checks

1. Open the Amplify frontend URL.
2. Register or log in.
3. Open Fleet > Map.
4. Upload/apply a noon report in Noon Reports.
5. Return to Fleet > Map and refresh noon positions.
6. Open Voyage Plan > Performance and confirm charts render from backend noon report data.

## 6. Production Hardening

- Move database credentials to AWS Secrets Manager.
- Restrict RDS inbound access to backend only.
- Add a custom domain in Amplify and App Runner.
- Update `CORS_ORIGINS` to the final frontend domain.
- Add CI build checks before merge:

```powershell
npm run build
```

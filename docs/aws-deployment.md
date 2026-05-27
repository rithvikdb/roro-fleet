# RORO Fleet AWS Test Deployment

This guide is for short AWS testing only. The account may have a six-month Free Plan and USD 100 credits, but AWS services are still metered. Keep resources small, set budget alerts first, and delete test resources when finished.

This app has three deployable parts:

- React frontend: static files from `npm run build`
- FastAPI backend: `backend.app.main:app`
- PostgreSQL database: schema in `deploy/postgresql-core-schema.sql`

## 0. Cost Guardrails First

Do this before creating RDS, App Runner, Amplify, NAT gateways, load balancers, or custom domains.

1. Open AWS Console > Billing and Cost Management > Budgets.
2. Create a monthly cost budget named `roro-fleet-test-budget`.
3. Set budget amount to `5 USD` for first test runs.
4. Add alerts at `50%`, `80%`, and `100%`.
5. Confirm the account is on the Free Plan and still has credits available.
6. Use one region only: `eu-central-1`.

Avoid these for testing unless you explicitly accept costs:

- NAT Gateway
- Multi-AZ RDS
- RDS storage above the free/credit test allowance
- App Runner always-on services left running after testing
- Route 53 hosted zones or custom domains
- Large CloudWatch log retention

## 1. AWS CLI Login

Use the AWS CLI only after the budget exists.

```powershell
aws configure
aws sts get-caller-identity
```

Use default region:

```text
eu-central-1
```

If using IAM Identity Center/SSO:

```powershell
aws configure sso
aws sso login
aws sts get-caller-identity
```

## 2. Keep GitHub As The Source Repository

The local repository already uses GitHub as `origin`. For the minimum test path, keep that and avoid creating a separate CodeCommit repository.

```powershell
git status
git remote -v
git push origin main
```

## 3. Create A Minimal PostgreSQL Database

Use Amazon RDS PostgreSQL only for a short test window.

Settings:

- Engine: PostgreSQL
- Template: Free tier or lowest-cost test template available in the account
- Deployment: Single-AZ
- Instance class: `db.t4g.micro` or `db.t3.micro`
- Storage: `20 GB` or lower if the console allows it
- Storage autoscaling: off
- Public access: off when possible
- Backups: shortest retention available for testing
- Database name: `roro_fleet`

Security group:

- Allow inbound PostgreSQL `5432` only from the backend service security group.
- Do not allow `0.0.0.0/0` unless this is a temporary manual schema-load step, and remove it immediately afterward.

Apply the schema from a machine that can reach RDS:

```powershell
psql "postgresql://<user>:<password>@<rds-host>:5432/roro_fleet" -f deploy/postgresql-core-schema.sql
```

If `psql` is unavailable locally, use AWS CloudShell or install PostgreSQL client tools locally.

## 4. Deploy The Backend For Short Tests

AWS App Runner is convenient, but it is metered. Create it only when ready to test, pause/delete it after testing, and monitor the budget.

1. AWS Console > App Runner > Create service.
2. Source: GitHub repository.
3. Runtime: Python 3.
4. Use the smallest CPU/memory option available.
5. Disable automatic deployments for cost control.
6. Build command:

```bash
pip install -r requirements.txt
```

7. Start command:

```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

8. Set environment variables:

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

## 5. Deploy The Frontend For Short Tests

AWS Amplify Hosting is also metered after free/credit limits. Use it only for the test window.

1. AWS Console > Amplify > Host web app.
2. Connect the GitHub repo.
3. App root: repository root.
4. Disable automatic deploys if you want manual cost control.
5. Build settings:

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

6. Add Amplify environment variable:

```text
REACT_APP_API_BASE_URL=https://<backend-service-url>
```

7. Redeploy frontend after setting the variable.

## 6. Test Checklist

1. Open the Amplify frontend URL.
2. Register or log in.
3. Open Fleet > Map.
4. Upload/apply a noon report in Noon Reports.
5. Return to Fleet > Map and refresh noon positions.
6. Open Voyage Plan > Performance and confirm charts render from backend noon report data.

## 7. Stop Costs After Testing

Do this at the end of every test session:

1. Delete or pause the App Runner service.
2. Delete the Amplify app if the test is complete.
3. Stop or delete the RDS instance. Delete it if there is no data to keep.
4. Delete manual snapshots that are no longer needed.
5. Check Billing > Bills and Cost Explorer the next day.

For a hard cleanup:

```powershell
aws apprunner list-services --region eu-central-1
aws amplify list-apps --region eu-central-1
aws rds describe-db-instances --region eu-central-1
```

Delete the listed RORO Fleet test resources from the console after confirming names and ARNs.

## 8. Production Hardening Later

Do not do these during the minimum-cost test unless required:

- Move database credentials to AWS Secrets Manager.
- Add custom domains.
- Add Route 53 hosted zones.
- Add managed NAT gateways.
- Enable larger RDS instances or Multi-AZ.
- Increase CloudWatch log retention.

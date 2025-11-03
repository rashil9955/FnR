# Fraud & Risk Detection Platform Prototype

This repository contains a full-stack prototype for a Fraud & Risk Detection Platform that integrates with the Plaid Sandbox, scores transactions with a Python machine-learning microservice, and provides a React dashboard for analysts and end users to review and act on flagged activity. **Sandbox only – never use real banking credentials in this project.**

## Contents

- `backend/` – Node.js + Express API with PostgreSQL persistence, Plaid integration, JWT auth, and ingestion workflows.
- `ml_service/` – Flask microservice that exposes `/score` and a training pipeline that builds a Gradient Boosting model on synthetic data.
- `frontend/` – React + Vite dashboard with Plaid Link integration, risk badges, and approval flows.
- `docker-compose.yml` – Development stack for Postgres, Redis, backend, ML service, and frontend.
- `scripts/` – Data generation helpers (see backend `scripts/seed.js`).

## Quick start (Docker Compose)

1. Copy the sample environment file and add your Plaid sandbox credentials:

   ```bash
   cp .env.example .env
   # edit .env and add PLAID_CLIENT_ID / PLAID_SECRET from https://dashboard.plaid.com/account/sandbox
   ```

2. Train the ML model (or use the included synthetic model):

   ```bash
   cd ml_service
   python train.py
   cd ..
   ```

   The script saves `ml_service/model/model.pkl` and a metrics snapshot.

3. Launch the stack:

   ```bash
   docker-compose up --build
   ```

   - Backend API → http://localhost:4000
   - ML Service → http://localhost:5000
   - Frontend → http://localhost:5173

4. Seed demo users and transactions (optional but recommended for UI testing):

   ```bash
   docker-compose exec backend npm run migrate
   docker-compose exec backend npm run seed
   # alternatively, post synthetic data to a running backend API
   node scripts/generate_synthetic_data.js
   ```

   This creates demo users (`user1@example.com`, `user2@example.com`) with password `password`, demo accounts, and a mix of legitimate + fraudulent transactions scored by the ML service.

5. Sign in at http://localhost:5173 with the seeded credentials and start reviewing flagged transactions.

## Local (non-Docker) setup

### Backend

```bash
cd backend
npm install
npm run migrate
npm run dev
```

Environment variables (see `.env.example`):

- `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV=sandbox`, `PLAID_PRODUCTS=transactions`
- `DATABASE_URL` (e.g. `postgres://postgres:postgres@localhost:5432/frauddb`)
- `ML_SERVICE_URL` (default `http://localhost:5000`)
- `JWT_SECRET`
- `RISK_FLAG_THRESHOLD`

If Plaid credentials are missing, the API returns stubbed sandbox tokens so you can demo flows without hitting Plaid.

### ML service

```bash
cd ml_service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python train.py  # builds model/model.pkl
python app.py    # starts Flask service on port 5000
```

### Frontend

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Set `VITE_API_BASE` in `.env` (frontend) if the backend runs on a non-default host.

## Plaid sandbox integration

- Create sandbox credentials in the Plaid dashboard.
- Use `/api/plaid/create_link_token` to obtain a Link token and initialize Plaid Link in the frontend (see `PlaidLinkButton` component).
- When Plaid Link returns a `public_token`, call `/api/plaid/exchange_public_token` to exchange for an `access_token`. The backend stores the item, fetches initial accounts/transactions, normalizes them, and calls the ML service for risk scoring.
- Sandbox testing hints:
  - Use Plaid's [test items](https://plaid.com/docs/sandbox/test-credentials/) (e.g. username `user_good`, password `pass_good`).
  - Simulate webhooks by `POST`ing a payload to `/api/plaid/webhook`. For example:

    ```bash
    curl -X POST http://localhost:4000/api/plaid/webhook \
      -H "Content-Type: application/json" \
      -d '{"webhook_type":"TRANSACTIONS","webhook_code":"DEFAULT_UPDATE","item_id":"sandbox-item"}'
    ```

  - To switch to production later, set `PLAID_ENV=production` and rotate credentials. **Never store access tokens in plaintext; move them to a secrets manager and encrypt them in transit and at rest.**

## Backend API overview

| Method & Path | Description |
| ------------- | ----------- |
| `POST /api/auth/register` | Create a user (prototype only). |
| `POST /api/auth/login` | Login and receive a JWT. |
| `GET /api/auth/me` | Retrieve authenticated user. |
| `POST /api/plaid/create_link_token` | Generate Plaid Link token (sandbox). |
| `POST /api/plaid/exchange_public_token` | Exchange public token, persist item/accounts, ingest transactions. |
| `POST /api/plaid/webhook` | Receive Plaid webhooks and refresh transactions. |
| `GET /api/transactions` | List latest transactions (with risk scores). |
| `POST /api/transactions/ingest` | Ingest manually supplied transactions (prototype/testing). |
| `POST /api/transactions/:id/score` | Re-score a transaction on demand. |
| `POST /api/transactions/:id/decision` | Approve or decline a flagged transaction. |
| `GET /api/admin/flags` | Admin view of flagged transactions (requires admin email). |
| `POST /api/admin/threshold` | Adjust in-memory risk flag threshold. |

### Transaction ingestion & risk scoring

- Transactions are normalized into the `transactions` table with fields such as `tx_id`, `user_id`, `account_id`, `amount`, `risk_score`, `is_flagged`, and `explanation` (top features + flags).
- `riskService.callRiskService` forwards the transaction and recent history to the ML microservice. If the service is unavailable, a rule-based fallback scores risk using heuristics (amount thresholds, merchant novelty).
- Scores ≥ `RISK_FLAG_THRESHOLD` (default 75) set `is_flagged` and create a record in the `flags` table. The frontend shows a modal prompting the user to approve or report the transaction.

## ML microservice

- `POST /score` expects a payload with `user_id`, `transaction`, and `history` (recent transactions). It responds with:

  ```json
  {
    "score": 92,
    "explanation": {
      "top_features": [{"feature": "amount_vs_avg_ratio", "weight": 0.6}],
      "flags": ["high_amount_vs_avg", "new_merchant"]
    },
    "recommended_action": "flag"
  }
  ```

- `train.py` generates synthetic cohorts of legitimate spending and injects fraud cases, trains a `GradientBoostingClassifier`, fits an `IsolationForest` anomaly detector, and writes `model/model.pkl` plus `model/metrics.json`.
- `utils.py` implements feature engineering (velocity, merchant frequency, amount vs. average, etc.) and a lightweight explanation method based on feature importances.

## Frontend experience

- Login with JWT; session stored in `localStorage`.
- Dashboard displays recent transactions with risk badges and explanation details (via modal for flagged events).
- Plaid Link integration via `react-plaid-link` enables connecting sandbox accounts and importing transactions.
- Approve/Report actions call the backend to persist decisions and update the transaction status.
- Admin users (emails ending in `@admin.local`) can query `/api/admin/flags` for oversight views (hook this into a separate admin UI if desired).

## Testing

### Backend (Jest + Supertest)

```bash
cd backend
npm test
```

### ML service (pytest)

```bash
cd ml_service
pytest
```

The backend tests mock Plaid and database dependencies to verify route wiring, and the ML tests cover `/health` and `/score` responses.

## Security, compliance, and production notes

- Sandbox only. Switching to production requires Plaid onboarding, credential rotation, webhook signature validation, and full adherence to PCI/GLBA requirements.
- Encrypt Plaid access tokens and sensitive user data. This prototype stores access tokens in plaintext for demonstration; never do this in production.
- Do not log secrets or personally identifiable information.
- Use HTTPS, enforce MFA for admin actions, and monitor audit trails.

## Switching to Plaid production (high-level)

1. Complete Plaid's production access application and security review.
2. Update environment variables: `PLAID_ENV=production`, replace client ID/secret, configure webhook URLs.
3. Implement Plaid Link production `client_name` and product scopes, and validate webhook signatures (stub provided in `plaidService`).
4. Migrate database secrets to a secrets manager (AWS Secrets Manager, Vault, etc.), encrypt tokens, and rotate regularly.
5. Harden infrastructure: deploy behind API gateway, enable TLS, configure observability and incident response runbooks.

## Minimal synthetic data generation

`backend/scripts/seed.js` seeds demo users, accounts, transactions, and risk scores by calling the ML service. Update the merchants/amounts to emulate different fraud scenarios or extend with more complex velocity rules.

`scripts/generate_synthetic_data.js` can push sample transactions to any running backend instance. Pass `API_BASE` (defaults to `http://localhost:4000/api`) and `API_TOKEN` (JWT) environment variables if needed.

## Example API flow

1. Frontend calls `POST /api/plaid/create_link_token` → receives `{ link_token }`.
2. User completes Plaid Link (sandbox) → frontend receives `public_token` and posts to `POST /api/plaid/exchange_public_token`.
3. Backend exchanges the token, stores item/accounts, fetches the last 90 days of transactions, normalizes, and calls the ML `/score` endpoint per transaction.
4. Transactions with `score >= RISK_FLAG_THRESHOLD` are flagged; the frontend displays a modal for user approval/denial.
5. User clicks “Report Fraud” → frontend calls `POST /api/transactions/:id/decision` → backend persists decision, optionally triggers downstream workflows (stubbed for prototype).

## License

This project is provided for educational and demonstration purposes only.

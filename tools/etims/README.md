# eTIMS / GavaConnect helpers

Aligned with Postman collection **eTIMS-OSCU-Integrator-Automated-Testing-SBX**.

## Postman

1. Import the official SBX collection.
2. Import [`postman.environment.sbx.json`](./postman.environment.sbx.json) (TIN / branch / device / URL prefilled for CRES SOFTWARE LIMITED).
3. Fill secrets: `consumer_key`, `consumer_secret`, `apigee_app_id` (or set Basic auth on Access Token + collection `apigee_app_id`).
4. Run **Access Token** → **OSCU initialization** → paste `cmcKey` into the env → **Save sales transaction information**.

## CLI (same contract as CresOS)

Requires `ETIMS_CONSUMER_KEY`, `ETIMS_CONSUMER_SECRET`, `ETIMS_APIGEE_APP_ID` in `apps/api/.env`:

```bash
node tools/etims/verify-gavaconnect.mjs          # token + initialize
node tools/etims/verify-gavaconnect.mjs --sales  # also sendSalesTransaction
```

## Local mock filing (no KRA credentials)

```bash
cd apps/api && npx ts-node-dev --transpile-only --respawn false src/scripts/etims-e2e-mock.ts
```

Expects `etimsStatus=mock` and `etimsResultCd=000`. With sandbox credentials set and mode=sandbox, Finance invoice create / File eTIMS yields `etimsStatus=submitted`.

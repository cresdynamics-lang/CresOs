#!/usr/bin/env node
/**
 * Mirrors Postman collection eTIMS-OSCU-Integrator-Automated-Testing-SBX:
 * 1) Access Token  2) Initialize  3) optional sendSalesTransaction
 *
 * Credentials from env (same as CresOS API):
 *   ETIMS_CONSUMER_KEY, ETIMS_CONSUMER_SECRET, ETIMS_APIGEE_APP_ID
 *   ETIMS_TIN, ETIMS_BHF_ID, ETIMS_DVC_SRL_NO, ETIMS_CMC_KEY (optional after init)
 *
 * Usage:
 *   node tools/etims/verify-gavaconnect.mjs           # token + init
 *   node tools/etims/verify-gavaconnect.mjs --sales   # also send a sales txn
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const apiEnv = resolve(root, "apps/api/.env");

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadDotEnv(apiEnv);

const TOKEN_URL =
  process.env.ETIMS_TOKEN_URL?.trim() ||
  "https://sbx.kra.go.ke/v1/token/generate?grant_type=client_credentials";
const OSCU_BASE =
  process.env.ETIMS_BASE_URL?.trim()?.replace(/\/$/, "") ||
  "https://sbx.kra.go.ke/etims-oscu/api/v1";

const consumerKey = process.env.ETIMS_CONSUMER_KEY?.trim() || "";
const consumerSecret = process.env.ETIMS_CONSUMER_SECRET?.trim() || "";
const apigeeAppId = process.env.ETIMS_APIGEE_APP_ID?.trim() || "";
const tin = process.env.ETIMS_TIN?.trim() || "P052570833B";
const bhfId = (process.env.ETIMS_BHF_ID || "00").slice(0, 2);
const dvcSrlNo = process.env.ETIMS_DVC_SRL_NO?.trim() || "CRESOSCU001";
let cmcKey = process.env.ETIMS_CMC_KEY?.trim() || "";

const wantSales = process.argv.includes("--sales");

function fail(msg, extra) {
  console.error("FAIL:", msg);
  if (extra) console.error(typeof extra === "string" ? extra : JSON.stringify(extra, null, 2));
  process.exit(1);
}

async function getToken() {
  if (!consumerKey || !consumerSecret) {
    fail(
      "Missing ETIMS_CONSUMER_KEY / ETIMS_CONSUMER_SECRET in apps/api/.env (GavaConnect Basic auth)"
    );
  }
  const basic = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "GET",
    headers: { Authorization: `Basic ${basic}`, Accept: "application/json" }
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    fail(`Access Token HTTP ${res.status}`, json);
  }
  console.log("OK Access Token (len=%d)", String(json.access_token).length);
  return String(json.access_token);
}

async function initialize(token) {
  if (!apigeeAppId) fail("Missing ETIMS_APIGEE_APP_ID");
  const res = await fetch(`${OSCU_BASE}/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      apigee_app_id: apigeeAppId
    },
    body: JSON.stringify({ tin, bhfId, dvcSrlNo })
  });
  const json = await res.json().catch(() => ({}));
  const resultCd = String(json.resultCd ?? "");
  const data = json.data || {};
  const info = data.info || data;
  const key = info.cmcKey || json.cmcKey || data.cmcKey;
  if (resultCd !== "000" || !key) {
    fail(`Initialize failed (${resultCd || res.status})`, json);
  }
  cmcKey = String(key);
  console.log("OK Initialize resultCd=000 cmcKey=…%s", cmcKey.slice(-6));
  console.log("  Paste into Postman env cmcKey and apps/api/.env ETIMS_CMC_KEY=");
  return json;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function kraNow(d = new Date()) {
  const y = d.getFullYear();
  const mo = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const h = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  const s = pad2(d.getSeconds());
  return { salesDt: `${y}${mo}${day}`, cfmDt: `${y}${mo}${day}${h}${mi}${s}` };
}

async function sendSales(token) {
  if (!cmcKey) fail("No cmcKey — run initialize first or set ETIMS_CMC_KEY");
  const { salesDt, cfmDt } = kraNow();
  const invcNo = Number(String(Date.now()).slice(-6));
  const body = {
    invcNo,
    orgInvcNo: 0,
    custTin: "A123456789Z",
    custNm: "Test Customer",
    salesTyCd: "N",
    rcptTyCd: "S",
    pmtTyCd: "01",
    salesSttsCd: "02",
    cfmDt,
    salesDt,
    stockRlsDt: null,
    cnclReqDt: null,
    cnclDt: null,
    rfdDt: null,
    rfdRsnCd: null,
    totItemCnt: 1,
    taxblAmtA: 0,
    taxblAmtB: 1000,
    taxblAmtC: 0,
    taxblAmtD: 0,
    taxblAmtE: 0,
    taxRtA: 0,
    taxRtB: 16,
    taxRtC: 0,
    taxRtD: 0,
    taxRtE: 0,
    taxAmtA: 0,
    taxAmtB: 160,
    taxAmtC: 0,
    taxAmtD: 0,
    taxAmtE: 0,
    totTaxblAmt: 1000,
    totTaxAmt: 160,
    totAmt: 1160,
    prchrAcptcYn: "N",
    remark: "CresOS verify-gavaconnect",
    regrId: "CRESOS",
    regrNm: "CresOS",
    modrId: "CRESOS",
    modrNm: "CresOS",
    receipt: {
      custTin: "A123456789Z",
      custMblNo: null,
      rptNo: invcNo,
      rcptPbctDt: cfmDt,
      trdeNm: "CRES SOFTWARE",
      adrs: "",
      topMsg: "CresOS",
      btmMsg: "Thank you",
      prchrAcptcYn: "N"
    },
    itemList: [
      {
        itemSeq: 1,
        itemCd: "KE2NTBA00000001",
        itemClsCd: "1000000000",
        itemNm: "CresOS verify item",
        bcd: null,
        pkgUnitCd: "NT",
        pkg: 1,
        qtyUnitCd: "BA",
        qty: 1,
        prc: 1160,
        splyAmt: 1160,
        dcRt: 0,
        dcAmt: 0,
        isrccCd: null,
        isrccNm: null,
        isrcRt: null,
        isrcAmt: null,
        taxTyCd: "B",
        taxblAmt: 1000,
        taxAmt: 160,
        totAmt: 1160
      }
    ]
  };

  const res = await fetch(`${OSCU_BASE}/sendSalesTransaction`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      tin,
      bhfId,
      cmcKey,
      apigee_app_id: apigeeAppId
    },
    body: JSON.stringify(body)
  });
  const json = await res.json().catch(() => ({}));
  const resultCd = String(json.resultCd ?? "");
  if (resultCd !== "000") {
    fail(`sendSalesTransaction failed (${resultCd || res.status})`, json);
  }
  console.log("OK sendSalesTransaction resultCd=000 invcNo=%s", invcNo);
  return json;
}

const token = await getToken();
await initialize(token);
if (wantSales) await sendSales(token);
console.log("Done.");

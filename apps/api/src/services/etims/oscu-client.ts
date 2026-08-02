/**
 * KRA eTIMS OSCU client + invoice filing for Cres Dynamics / CRES SOFTWARE LIMITED.
 *
 * Endpoints (spec):
 *  - POST /selectInitOsdcInfo  — device init → cmcKey
 *  - POST /saveTrnsSalesOsdc   — file sales invoice
 *
 * Modes: mock (local demo without KRA token) | sandbox | production
 */

import type { PrismaClient, Invoice, InvoiceItem, Client, OrgEtimsConfig } from "@prisma/client";
import { createHash, randomBytes } from "crypto";

export const DEFAULT_SELLER_TIN = "P052570833B";
export const DEFAULT_SELLER_NAME = "CRES SOFTWARE LIMITED";
export const DEFAULT_DVC_SRL = "CRESOSCU001";

const SBX_BASE = "https://etims-api-sbx.kra.go.ke";
const PROD_BASE = "https://etims-api.kra.go.ke";

/** Kenya KRA PIN: letter + 9 digits + letter */
export function isValidKenyaPin(pin: string | null | undefined): boolean {
  if (!pin) return false;
  return /^[A-Z]\d{9}[A-Z]$/i.test(pin.trim());
}

export function normalizeKenyaPin(pin: string | null | undefined): string | null {
  if (!pin) return null;
  const p = pin.trim().toUpperCase();
  return isValidKenyaPin(p) ? p : null;
}

const TAX_RATES: Record<string, number> = {
  A: 0,
  B: 16,
  C: 0,
  D: 0,
  E: 8
};

export type EtimsMode = "mock" | "sandbox" | "production";

export type EtimsInvoiceItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type EtimsSubmitResult = {
  ok: boolean;
  status: "submitted" | "failed" | "skipped" | "mock";
  resultCd?: string;
  resultMsg?: string;
  invcNo?: number;
  sdcId?: string;
  mrcNo?: string;
  rcptNo?: string;
  internalData?: string;
  receiptSign?: string;
  qrCodeUrl?: string;
  raw?: unknown;
};

function baseUrlForMode(mode: EtimsMode): string {
  if (process.env.ETIMS_BASE_URL?.trim()) return process.env.ETIMS_BASE_URL.trim().replace(/\/$/, "");
  return mode === "production" ? PROD_BASE : SBX_BASE;
}

function envMode(): EtimsMode {
  const m = (process.env.ETIMS_MODE || "mock").toLowerCase();
  if (m === "production" || m === "prod") return "production";
  if (m === "sandbox" || m === "sbx") return "sandbox";
  return "mock";
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** yyyyMMdd / yyyyMMddHHmmss in Africa/Nairobi-ish local server time */
export function kraDateTimeParts(d = new Date()) {
  const y = d.getFullYear();
  const mo = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const h = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  const s = pad2(d.getSeconds());
  return {
    salesDt: `${y}${mo}${day}`,
    cfmDt: `${y}${mo}${day}${h}${mi}${s}`,
    resultDt: `${y}${mo}${day}${h}${mi}${s}`
  };
}

function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Split amounts into eTIMS taxable / tax buckets for a single tax type.
 */
export function computeTaxBuckets(
  lineTotal: number,
  taxTyCd: string,
  vatInclusive: boolean
): { taxbl: number; tax: number; tot: number; rate: number } {
  const rate = TAX_RATES[taxTyCd] ?? 0;
  if (rate <= 0) {
    return { taxbl: money(lineTotal), tax: 0, tot: money(lineTotal), rate: 0 };
  }
  if (vatInclusive) {
    const taxbl = money(lineTotal / (1 + rate / 100));
    const tax = money(lineTotal - taxbl);
    return { taxbl, tax, tot: money(lineTotal), rate };
  }
  const taxbl = money(lineTotal);
  const tax = money((lineTotal * rate) / 100);
  return { taxbl, tax, tot: money(taxbl + tax), rate };
}

function itemCodeFromDescription(desc: string, seq: number): string {
  const hash = createHash("sha1").update(desc).digest("hex").slice(0, 8).toUpperCase();
  return `KE2NTXI${hash}${String(seq).padStart(2, "0")}`.slice(0, 20);
}

async function kraPost(
  mode: EtimsMode,
  path: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const url = `${baseUrlForMode(mode)}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body)
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    json = { resultCd: "999", resultMsg: `Non-JSON response (${res.status})` };
  }
  return { ok: res.ok, status: res.status, json };
}

export type ResolvedEtimsConfig = {
  id: string | null;
  orgId: string;
  tin: string;
  taxpayerName: string;
  bhfId: string;
  dvcSrlNo: string;
  cmcKey: string | null;
  sdcId: string | null;
  mrcNo: string | null;
  dvcId: string | null;
  mode: EtimsMode;
  enabled: boolean;
  autoSubmit: boolean;
  defaultTaxTyCd: string;
  vatInclusive: boolean;
  lastInvcNo: number;
};

/** Ensure org has a config row (seeded from env / CRES defaults). */
export async function ensureOrgEtimsConfig(
  prisma: PrismaClient,
  orgId: string
): Promise<OrgEtimsConfig> {
  const existing = await prisma.orgEtimsConfig.findUnique({ where: { orgId } });
  if (existing) return existing;

  const tin = normalizeKenyaPin(process.env.ETIMS_TIN) || DEFAULT_SELLER_TIN;
  const mode = envMode();
  return prisma.orgEtimsConfig.create({
    data: {
      orgId,
      tin,
      taxpayerName: process.env.ETIMS_TAXPAYER_NAME?.trim() || DEFAULT_SELLER_NAME,
      bhfId: (process.env.ETIMS_BHF_ID || "00").slice(0, 2),
      dvcSrlNo: process.env.ETIMS_DVC_SRL_NO?.trim() || DEFAULT_DVC_SRL,
      cmcKey: process.env.ETIMS_CMC_KEY?.trim() || null,
      mode,
      enabled: process.env.ETIMS_ENABLED !== "false",
      autoSubmit: process.env.ETIMS_AUTO_SUBMIT !== "false",
      defaultTaxTyCd: (process.env.ETIMS_DEFAULT_TAX_TYPE || "B").toUpperCase().slice(0, 1),
      vatInclusive: process.env.ETIMS_VAT_INCLUSIVE === "true"
    }
  });
}

export function toPublicConfig(c: OrgEtimsConfig): ResolvedEtimsConfig {
  return {
    id: c.id,
    orgId: c.orgId,
    tin: c.tin,
    taxpayerName: c.taxpayerName || DEFAULT_SELLER_NAME,
    bhfId: c.bhfId,
    dvcSrlNo: c.dvcSrlNo,
    cmcKey: c.cmcKey ? "••••" + c.cmcKey.slice(-6) : null,
    sdcId: c.sdcId,
    mrcNo: c.mrcNo,
    dvcId: c.dvcId,
    mode: (c.mode as EtimsMode) || "mock",
    enabled: c.enabled,
    autoSubmit: c.autoSubmit,
    defaultTaxTyCd: c.defaultTaxTyCd,
    vatInclusive: c.vatInclusive,
    lastInvcNo: c.lastInvcNo
  };
}

/** Initialize device with KRA (or mock success). Stores cmcKey. */
export async function initializeEtimsDevice(
  prisma: PrismaClient,
  orgId: string
): Promise<{ ok: boolean; message: string; config: ResolvedEtimsConfig }> {
  const cfg = await ensureOrgEtimsConfig(prisma, orgId);
  const mode = (cfg.mode as EtimsMode) || envMode();

  if (mode === "mock") {
    const mockKey = createHash("sha256").update(`${cfg.tin}:${cfg.dvcSrlNo}:mock`).digest("hex").slice(0, 32);
    const updated = await prisma.orgEtimsConfig.update({
      where: { orgId },
      data: {
        cmcKey: mockKey,
        sdcId: `MOCK-SDC-${cfg.tin.slice(1, 7)}`,
        mrcNo: `MRC${String(Date.now()).slice(-8)}`,
        dvcId: `DVC${cfg.dvcSrlNo}`.slice(0, 20),
        lastInitAt: new Date(),
        lastError: null
      }
    });
    return {
      ok: true,
      message: "Mock OSCU initialized (no KRA call). Switch mode to sandbox/production after you receive the integration token.",
      config: toPublicConfig(updated)
    };
  }

  try {
    const { ok, json } = await kraPost(mode, "/selectInitOsdcInfo", {
      tin: cfg.tin,
      bhfId: cfg.bhfId,
      dvcSrlNo: cfg.dvcSrlNo
    });
    const resultCd = String(json.resultCd ?? "");
    const data = (json.data as Record<string, unknown> | undefined)?.info as
      | Record<string, unknown>
      | undefined;
    const nested = (json.data as Record<string, unknown> | undefined) ?? {};
    const info = data ?? nested;

    const cmcKey =
      (info.cmcKey as string | undefined) ||
      (json.cmcKey as string | undefined) ||
      process.env.ETIMS_CMC_KEY?.trim() ||
      null;

    if (!ok || (resultCd && resultCd !== "000") || !cmcKey) {
      const msg =
        String(json.resultMsg || json.message || "Device initialization failed") +
        (resultCd ? ` (${resultCd})` : "");
      await prisma.orgEtimsConfig.update({
        where: { orgId },
        data: { lastError: msg, lastInitAt: new Date() }
      });
      return { ok: false, message: msg, config: toPublicConfig(cfg) };
    }

    const updated = await prisma.orgEtimsConfig.update({
      where: { orgId },
      data: {
        cmcKey,
        sdcId: (info.sdcId as string) || cfg.sdcId,
        mrcNo: (info.mrcNo as string) || cfg.mrcNo,
        dvcId: (info.dvcId as string) || cfg.dvcId,
        taxpayerName: (info.taxprNm as string) || cfg.taxpayerName,
        lastInitAt: new Date(),
        lastError: null
      }
    });
    return {
      ok: true,
      message: String(json.resultMsg || "OSCU device initialized"),
      config: toPublicConfig(updated)
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Init request failed";
    await prisma.orgEtimsConfig.update({
      where: { orgId },
      data: { lastError: msg, lastInitAt: new Date() }
    });
    return { ok: false, message: msg, config: toPublicConfig(cfg) };
  }
}

function buildSalesPayload(
  cfg: OrgEtimsConfig,
  invcNo: number,
  traderNumber: string,
  buyerPin: string | null,
  buyerName: string,
  issueDate: Date,
  items: EtimsInvoiceItem[],
  taxTyCd: string
) {
  const { salesDt, cfmDt } = kraDateTimeParts(issueDate);
  const rate = TAX_RATES[taxTyCd] ?? 16;

  let taxblAmtA = 0,
    taxblAmtB = 0,
    taxblAmtC = 0,
    taxblAmtD = 0,
    taxblAmtE = 0;
  let taxAmtA = 0,
    taxAmtB = 0,
    taxAmtC = 0,
    taxAmtD = 0,
    taxAmtE = 0;

  const itemList = items.map((it, idx) => {
    const lineTot = money(it.quantity * it.unitPrice);
    const bucket = computeTaxBuckets(lineTot, taxTyCd, cfg.vatInclusive);
    if (taxTyCd === "A") {
      taxblAmtA += bucket.taxbl;
      taxAmtA += bucket.tax;
    } else if (taxTyCd === "C") {
      taxblAmtC += bucket.taxbl;
      taxAmtC += bucket.tax;
    } else if (taxTyCd === "D") {
      taxblAmtD += bucket.taxbl;
      taxAmtD += bucket.tax;
    } else if (taxTyCd === "E") {
      taxblAmtE += bucket.taxbl;
      taxAmtE += bucket.tax;
    } else {
      taxblAmtB += bucket.taxbl;
      taxAmtB += bucket.tax;
    }

    const spc = bucket.taxbl; // supply price / taxable
    const splyAmt = bucket.tot;
    return {
      itemSeq: idx + 1,
      itemCd: itemCodeFromDescription(it.description, idx + 1),
      itemClsCd: "5020230101",
      itemNm: it.description.slice(0, 200),
      bcd: null,
      pkgUnitCd: "NT",
      pkg: 1,
      qtyUnitCd: "U",
      qty: it.quantity,
      prc: money(it.unitPrice),
      splyAmt: money(splyAmt),
      dcRt: 0,
      dcAmt: 0,
      isrccCd: null,
      isrccNm: null,
      isrcRt: null,
      isrcAmt: null,
      taxTyCd,
      taxblAmt: money(spc),
      taxAmt: money(bucket.tax),
      totAmt: money(bucket.tot)
    };
  });

  taxblAmtA = money(taxblAmtA);
  taxblAmtB = money(taxblAmtB);
  taxblAmtC = money(taxblAmtC);
  taxblAmtD = money(taxblAmtD);
  taxblAmtE = money(taxblAmtE);
  taxAmtA = money(taxAmtA);
  taxAmtB = money(taxAmtB);
  taxAmtC = money(taxAmtC);
  taxAmtD = money(taxAmtD);
  taxAmtE = money(taxAmtE);

  const totTaxblAmt = money(taxblAmtA + taxblAmtB + taxblAmtC + taxblAmtD + taxblAmtE);
  const totTaxAmt = money(taxAmtA + taxAmtB + taxAmtC + taxAmtD + taxAmtE);
  const totAmt = money(totTaxblAmt + totTaxAmt);

  return {
    tin: cfg.tin,
    bhfId: cfg.bhfId,
    cmcKey: cfg.cmcKey,
    invcNo,
    orgInvcNo: 0,
    custTin: buyerPin || null,
    custNm: buyerName.slice(0, 60),
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
    totItemCnt: itemList.length,
    taxblAmtA,
    taxblAmtB,
    taxblAmtC,
    taxblAmtD,
    taxblAmtE,
    taxRtA: 0,
    taxRtB: rate,
    taxRtC: 0,
    taxRtD: 0,
    taxRtE: TAX_RATES.E,
    taxAmtA,
    taxAmtB,
    taxAmtC,
    taxAmtD,
    taxAmtE,
    totTaxblAmt,
    totTaxAmt,
    totAmt,
    prchrAcptcYn: "N",
    remark: traderNumber.slice(0, 400),
    regrId: "CRESOS",
    regrNm: "CresOS Finance",
    modrId: "CRESOS",
    modrNm: "CresOS Finance",
    receipt: {
      custTin: buyerPin || null,
      custMblNo: null,
      rptNo: invcNo,
      trdeNm: (cfg.taxpayerName || DEFAULT_SELLER_NAME).slice(0, 20),
      adrs: null,
      topMsg: "eTIMS Tax Invoice",
      btmMsg: "Thank you",
      prchrAcptcYn: "N"
    },
    itemList
  };
}

function mockSubmitResult(invcNo: number, cfg: OrgEtimsConfig): EtimsSubmitResult {
  const sign = randomBytes(16).toString("hex");
  const sdc = cfg.sdcId || "MOCK-SDC";
  const mrc = cfg.mrcNo || "MRC00000001";
  return {
    ok: true,
    status: "mock",
    resultCd: "000",
    resultMsg: "Mock eTIMS filing succeeded (awaiting real OSCU token)",
    invcNo,
    sdcId: sdc,
    mrcNo: mrc,
    rcptNo: String(invcNo),
    internalData: `${sdc}/${invcNo}/${sign.slice(0, 12)}`,
    receiptSign: sign,
    qrCodeUrl: `https://etims.kra.go.ke/common/link/etims/receipt/indexEtimsReceiptData?Data=${encodeURIComponent(
      `${cfg.tin}${sdc}${invcNo}`
    )}`,
    raw: { mock: true, resultCd: "000" }
  };
}

/**
 * File one invoice to eTIMS (auto from create, or manual retry).
 */
export async function submitInvoiceToEtims(
  prisma: PrismaClient,
  orgId: string,
  invoiceId: string,
  options?: { force?: boolean }
): Promise<EtimsSubmitResult> {
  const cfg = await ensureOrgEtimsConfig(prisma, orgId);

  if (!cfg.enabled && !options?.force) {
    return { ok: false, status: "skipped", resultMsg: "eTIMS is disabled for this organisation" };
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, orgId, deletedAt: null },
    include: {
      items: true,
      client: { select: { id: true, name: true, kraPin: true, phone: true } }
    }
  });
  if (!invoice) {
    return { ok: false, status: "failed", resultMsg: "Invoice not found" };
  }
  if (invoice.etimsStatus === "submitted" || invoice.etimsStatus === "mock") {
    if (!options?.force) {
      return {
        ok: true,
        status: invoice.etimsStatus as "submitted" | "mock",
        resultMsg: "Already filed",
        invcNo: invoice.etimsInvcNo ?? undefined,
        sdcId: invoice.etimsSdcId ?? undefined,
        mrcNo: invoice.etimsMrcNo ?? undefined,
        receiptSign: invoice.etimsReceiptSign ?? undefined,
        qrCodeUrl: invoice.etimsQrCodeUrl ?? undefined
      };
    }
  }

  const buyerPin =
    normalizeKenyaPin(invoice.buyerKraPin) ||
    normalizeKenyaPin(invoice.client.kraPin) ||
    null;

  const mode = (cfg.mode as EtimsMode) || "mock";
  const taxTyCd = (cfg.defaultTaxTyCd || "B").toUpperCase().slice(0, 1);

  // Allocate sequential eTIMS invcNo
  const updatedCfg = await prisma.orgEtimsConfig.update({
    where: { orgId },
    data: { lastInvcNo: { increment: 1 } }
  });
  const invcNo = updatedCfg.lastInvcNo;

  const items: EtimsInvoiceItem[] = invoice.items.map((it) => ({
    description: it.description,
    quantity: it.quantity,
    unitPrice: Number(it.unitPrice)
  }));

  if (mode === "mock" || !cfg.cmcKey) {
    const mock = mockSubmitResult(invcNo, updatedCfg);
    await persistEtimsResult(prisma, invoice.id, buyerPin, mock);
    if (!cfg.cmcKey && mode !== "mock") {
      await prisma.orgEtimsConfig.update({
        where: { orgId },
        data: {
          lastError:
            "No CMC key — filed in mock mode. Initialize OSCU after KRA issues the integration token."
        }
      });
    }
    return mock;
  }

  const payload = buildSalesPayload(
    { ...updatedCfg, cmcKey: cfg.cmcKey },
    invcNo,
    invoice.number,
    buyerPin,
    invoice.client.name,
    invoice.issueDate,
    items,
    taxTyCd
  );

  try {
    const { json } = await kraPost(mode, "/saveTrnsSalesOsdc", payload as unknown as Record<string, unknown>);
    const resultCd = String(json.resultCd ?? "999");
    const resultMsg = String(json.resultMsg ?? "Unknown response");
    const data = (json.data as Record<string, unknown>) || {};

    if (resultCd !== "000") {
      const fail: EtimsSubmitResult = {
        ok: false,
        status: "failed",
        resultCd,
        resultMsg,
        invcNo,
        raw: json
      };
      await persistEtimsResult(prisma, invoice.id, buyerPin, fail);
      await prisma.orgEtimsConfig.update({
        where: { orgId },
        data: { lastError: `${resultCd}: ${resultMsg}` }
      });
      return fail;
    }

    const success: EtimsSubmitResult = {
      ok: true,
      status: "submitted",
      resultCd,
      resultMsg,
      invcNo,
      sdcId: (data.sdcId as string) || cfg.sdcId || undefined,
      mrcNo: (data.mrcNo as string) || cfg.mrcNo || undefined,
      rcptNo: data.rcptNo != null ? String(data.rcptNo) : String(invcNo),
      internalData: (data.intrlData as string) || (data.internalData as string) || undefined,
      receiptSign: (data.rcptSign as string) || (data.receiptSign as string) || undefined,
      qrCodeUrl: (data.qrCodeUrl as string) || undefined,
      raw: json
    };
    await persistEtimsResult(prisma, invoice.id, buyerPin, success);
    await prisma.orgEtimsConfig.update({
      where: { orgId },
      data: { lastError: null }
    });
    return success;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "eTIMS submit failed";
    const fail: EtimsSubmitResult = {
      ok: false,
      status: "failed",
      resultMsg: msg,
      invcNo
    };
    await persistEtimsResult(prisma, invoice.id, buyerPin, fail);
    await prisma.orgEtimsConfig.update({
      where: { orgId },
      data: { lastError: msg }
    });
    return fail;
  }
}

async function persistEtimsResult(
  prisma: PrismaClient,
  invoiceId: string,
  buyerPin: string | null,
  result: EtimsSubmitResult
) {
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      buyerKraPin: buyerPin,
      etimsStatus: result.status,
      etimsInvcNo: result.invcNo ?? null,
      etimsSdcId: result.sdcId ?? null,
      etimsMrcNo: result.mrcNo ?? null,
      etimsRcptNo: result.rcptNo ?? null,
      etimsInternalData: result.internalData ?? null,
      etimsReceiptSign: result.receiptSign ?? null,
      etimsQrCodeUrl: result.qrCodeUrl ?? null,
      etimsSubmittedAt: result.ok || result.status === "mock" ? new Date() : new Date(),
      etimsResultCd: result.resultCd ?? null,
      etimsResultMsg: result.resultMsg ?? null,
      etimsRawResponse: result.raw ? JSON.stringify(result.raw).slice(0, 8000) : null
    }
  });
}

/** Auto-file after invoice create when config allows. */
export async function maybeAutoSubmitInvoice(
  prisma: PrismaClient,
  orgId: string,
  invoiceId: string
): Promise<EtimsSubmitResult | null> {
  try {
    const cfg = await ensureOrgEtimsConfig(prisma, orgId);
    if (!cfg.enabled || !cfg.autoSubmit) return null;
    return await submitInvoiceToEtims(prisma, orgId, invoiceId);
  } catch (e) {
    console.error("[etims] auto-submit failed:", e);
    return {
      ok: false,
      status: "failed",
      resultMsg: e instanceof Error ? e.message : "auto-submit failed"
    };
  }
}

export type { Invoice, InvoiceItem, Client };

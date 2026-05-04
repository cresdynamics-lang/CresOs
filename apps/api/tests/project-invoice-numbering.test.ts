import { describe, expect, it, vi } from "vitest";
import {
  formatOrgInvoiceNumber,
  formatProjectInvoiceNumber,
  allocateInvoiceNumberForCreate,
  allocateNextProjectInvoiceNumber
} from "../src/services/invoice/invoice-number";

describe("formatProjectInvoiceNumber", () => {
  it("formats first project first invoice for 2026", () => {
    expect(formatProjectInvoiceNumber(1, 1, 2026)).toBe("001/01/26");
  });

  it("pads project and invoice ordinals", () => {
    expect(formatProjectInvoiceNumber(12, 3, 2026)).toBe("012/03/26");
  });

  it("uses two-digit year modulo century", () => {
    expect(formatProjectInvoiceNumber(1, 99, 1999)).toBe("001/99/99");
  });
});

describe("formatOrgInvoiceNumber", () => {
  it("keeps legacy CD-INV shape", () => {
    expect(formatOrgInvoiceNumber(1, new Date("2026-03-01"))).toBe("CD-INV-000001/26");
  });
});

describe("allocateNextProjectInvoiceNumber", () => {
  it("uses PPP/II/YY and bumps nextInvoiceOrdinal", async () => {
    const tx = {
      project: {
        findFirst: vi.fn().mockResolvedValue({
          id: "p1",
          financeProjectSeq: 1,
          financeRefYear: 2026,
          nextInvoiceOrdinal: 1
        }),
        update: vi.fn().mockResolvedValue(undefined)
      }
    };
    const n = await allocateNextProjectInvoiceNumber(tx as never, "org", "p1", new Date());
    expect(n).toBe("001/01/26");
    expect(tx.project.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { nextInvoiceOrdinal: 2 }
    });
  });

  it("falls back to org-wide number when finance seq missing", async () => {
    const tx = {
      project: {
        findFirst: vi.fn().mockResolvedValue({
          id: "p1",
          financeProjectSeq: null,
          financeRefYear: null,
          nextInvoiceOrdinal: 1
        }),
        update: vi.fn()
      },
      invoice: {
        count: vi.fn().mockResolvedValue(5)
      }
    };
    const n = await allocateNextProjectInvoiceNumber(tx as never, "org", "p1", new Date("2026-01-01"));
    expect(n).toBe("CD-INV-000006/26");
    expect(tx.project.update).not.toHaveBeenCalled();
  });
});

describe("allocateInvoiceNumberForCreate", () => {
  it("delegates to project allocator when projectId set", async () => {
    const tx = {
      project: {
        findFirst: vi.fn().mockResolvedValue({
          id: "p1",
          financeProjectSeq: 2,
          financeRefYear: 2026,
          nextInvoiceOrdinal: 1
        }),
        update: vi.fn()
      }
    };
    const n = await allocateInvoiceNumberForCreate(tx as never, "org", "p1", new Date());
    expect(n).toBe("002/01/26");
  });

  it("uses org-wide when no projectId", async () => {
    const tx = {
      invoice: { count: vi.fn().mockResolvedValue(0) }
    };
    const n = await allocateInvoiceNumberForCreate(tx as never, "org", undefined, new Date("2026-06-15"));
    expect(n).toBe("CD-INV-000001/26");
  });
});

import type { PrismaClient } from "@prisma/client";
import { PDFGenerator } from "../services/invoice/pdf-generator";
import type { InvoiceSchema } from "../services/invoice/schema";
import { CRES_DYNAMICS_PDF_COMPANY } from "./company-pdf";

export function buildInvoicePdfNotes(savedNotes: string | null | undefined): string {
  const user = savedNotes?.trim() ?? "";
  const standard =
    "Late payments attract 2% monthly interest after the due date. For payment queries contact info@cresdynamics.com or +254 0708 805 496.";
  return [user, standard].filter(Boolean).join("\n\n");
}

export async function generateInvoicePdfBuffer(
  prisma: PrismaClient,
  orgId: string,
  invoiceId: string
): Promise<{ buffer: Buffer; number: string; filename: string; currency: string; totalAmount: number }> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, orgId, deletedAt: null },
    include: {
      client: { select: { name: true, email: true, phone: true } },
      project: { select: { name: true } },
      items: true
    }
  });

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const totalAmount = Number(invoice.totalAmount);
  const schema: InvoiceSchema = {
    invoice_number: invoice.number,
    invoice_date: invoice.issueDate.toISOString().split("T")[0],
    due_date: invoice.dueDate ? invoice.dueDate.toISOString().split("T")[0] : "",
    status: invoice.status as InvoiceSchema["status"],
    currency: invoice.currency,
    client: {
      id: invoice.clientId,
      name: invoice.client.name,
      email: invoice.client.email ?? undefined,
      phone: invoice.client.phone ?? undefined
    },
    company: { ...CRES_DYNAMICS_PDF_COMPANY },
    project: invoice.project
      ? {
          id: invoice.projectId!,
          name: invoice.project.name
        }
      : undefined,
    items: invoice.items.map((item) => {
      const unit = Number(item.unitPrice);
      const line = unit * item.quantity;
      return {
        id: item.id,
        name: item.description,
        description: item.description,
        quantity: item.quantity,
        unit_price: unit,
        total_price: line,
        type: "service" as const,
        category: "general"
      };
    }),
    summary: {
      subtotal: totalAmount,
      tax_rate: 0,
      tax_amount: 0,
      total_amount: totalAmount,
      balance_due: totalAmount
    },
    payment_terms: {
      due_in_days: 7
    },
    notes: {
      client_message: buildInvoicePdfNotes(invoice.notes)
    },
    automation: {
      auto_reminders_enabled: true,
      reminder_schedule: [3, 1],
      late_fee_enabled: false
    },
    created_at: invoice.createdAt.toISOString(),
    updated_at: invoice.updatedAt.toISOString(),
    created_by: "system",
    organization_id: orgId
  };

  const pdfGenerator = new PDFGenerator({
    filename: `${invoice.number}.pdf`,
    format: "A4",
    margin: { top: 40, right: 40, bottom: 40, left: 40 }
  });

  const buffer = await pdfGenerator.generatePDF(schema);
  return {
    buffer,
    number: invoice.number,
    filename: `${invoice.number}.pdf`,
    currency: invoice.currency,
    totalAmount
  };
}

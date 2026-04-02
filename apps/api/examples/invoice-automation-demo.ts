/**
 * CresOS Invoice Automation System - Usage Example
 * 
 * This file demonstrates how to use the complete invoice automation system
 * to generate different types of invoices and manage financial operations.
 */

import { InvoiceAutomationService } from '../src/services/invoice/automation';
import { InvoiceDataMapper } from '../src/services/invoice/mapper';
import { PDFGenerator } from '../src/services/invoice/pdf-generator';
import { InvoiceSchema } from '../src/services/invoice/schema';

// Example Configuration
const exampleConfig = {
  organization_id: "cresos-demo-org",
  invoice_number: {
    prefix: "CD-INV",
    format: "{seq:3}/{year:2}", // Generates: CD-INV-001/26
    separator: "-",
    reset_frequency: "yearly" as const,
  },
  due_date: {
    default_days: 7, // 7 days after invoice date as requested
    business_days_only: false,
  },
  tax: {
    default_rate: 0, // No tax by default
  },
  automation: {
    auto_generate_on_project_create: false,
    auto_generate_on_milestone_complete: true,
    auto_send_invoice: false,
    auto_reminders: {
      enabled: true,
      schedule: [3, 1], // 3 days and 1 day before due date
    },
  },
};

// Example Project Data
const exampleProject = {
  id: "project-123",
  name: "E-commerce Website Development",
  description: "Full-stack e-commerce platform with payment integration",
  client_id: "client-456",
  client_name: "Acme Corporation",
  client_email: "billing@acme.com",
  client_phone: "+1-555-0123",
  services: [
    {
      name: "Frontend Development",
      price: 8000,
      description: "React-based frontend with responsive design",
      type: "service" as const,
    },
    {
      name: "Backend API",
      price: 6000,
      description: "Node.js REST API with database integration",
      type: "service" as const,
    },
    {
      name: "Payment Integration",
      price: 2500,
      description: "Stripe payment gateway integration",
      type: "service" as const,
    },
  ],
  total_price: 16500,
  start_date: "2026-04-01",
  end_date: "2026-06-30",
  milestones: [
    {
      id: "milestone-1",
      title: "Frontend Completion",
      description: "Complete frontend development and testing",
      due_date: "2026-05-01",
      budget: 8000,
      completed_at: "2026-04-28",
    },
    {
      id: "milestone-2",
      title: "Backend API",
      description: "Complete backend API development",
      due_date: "2026-05-15",
      budget: 6000,
      completed_at: null,
    },
  ],
};

// Example Organization Data
const exampleOrganization = {
  id: "cresos-demo-org",
  name: "CresOS Solutions",
  email: "invoices@cresos.com",
  phone: "+1-555-9999",
  address: {
    street: "123 Tech Street",
    city: "San Francisco",
    country: "USA",
    postal_code: "94105",
  },
  logo_url: "https://cresos.com/logo.png",
  tax_id: "12-3456789",
  website: "https://cresos.com",
};

/**
 * Example 1: Generate Standard Invoice
 */
async function generateStandardInvoice() {
  console.log("🚀 Generating Standard Invoice...");
  
  try {
    // Map project data to invoice schema
    const invoice = InvoiceDataMapper.mapProjectToInvoice(
      exampleProject,
      exampleOrganization,
      exampleConfig,
      'standard'
    );
    
    console.log("✅ Standard Invoice Generated:");
    console.log(`   Invoice Number: ${invoice.invoice_number}`);
    console.log(`   Due Date: ${invoice.due_date}`);
    console.log(`   Total Amount: $${invoice.summary.total_amount.toFixed(2)}`);
    console.log(`   Items: ${invoice.items.length}`);
    
    return invoice;
  } catch (error) {
    console.error("❌ Error generating standard invoice:", error);
    throw error;
  }
}

/**
 * Example 2: Generate Milestone Invoice
 */
async function generateMilestoneInvoice() {
  console.log("🚀 Generating Milestone Invoice...");
  
  try {
    const invoice = InvoiceDataMapper.mapProjectToInvoice(
      exampleProject,
      exampleOrganization,
      exampleConfig,
      'milestone',
      'milestone-1' // Specific milestone ID
    );
    
    console.log("✅ Milestone Invoice Generated:");
    console.log(`   Invoice Number: ${invoice.invoice_number}`);
    console.log(`   Milestone: ${invoice.items[0].milestone?.title}`);
    console.log(`   Total Amount: $${invoice.summary.total_amount.toFixed(2)}`);
    
    return invoice;
  } catch (error) {
    console.error("❌ Error generating milestone invoice:", error);
    throw error;
  }
}

/**
 * Example 3: Generate Retainer Invoice
 */
async function generateRetainerInvoice() {
  console.log("🚀 Generating Retainer Invoice...");
  
  try {
    const invoice = InvoiceDataMapper.mapProjectToInvoice(
      exampleProject,
      exampleOrganization,
      exampleConfig,
      'retainer'
    );
    
    console.log("✅ Retainer Invoice Generated:");
    console.log(`   Invoice Number: ${invoice.invoice_number}`);
    console.log(`   Period: ${invoice.items[0].retainer_period?.start_date} to ${invoice.items[0].retainer_period?.end_date}`);
    console.log(`   Total Amount: $${invoice.summary.total_amount.toFixed(2)}`);
    
    return invoice;
  } catch (error) {
    console.error("❌ Error generating retainer invoice:", error);
    throw error;
  }
}

/**
 * Example 4: Generate Custom Invoice
 */
async function generateCustomInvoice() {
  console.log("🚀 Generating Custom Invoice...");
  
  try {
    const customInvoiceData = {
      client: {
        id: "client-789",
        name: "Tech Startup Inc",
        email: "finance@techstartup.com",
        phone: "+1-555-4567",
        address: {
          street: "456 Innovation Drive",
          city: "Austin",
          country: "USA",
          postal_code: "78701",
        },
      },
      items: [
        {
          id: "custom-1",
          name: "Technical Consulting",
          description: "10 hours of technical consulting services",
          quantity: 10,
          unit_price: 250,
          total_price: 2500,
          type: "service" as const,
          category: "consulting",
        },
        {
          id: "custom-2",
          name: "Code Review",
          description: "Comprehensive code review and optimization",
          quantity: 1,
          unit_price: 1500,
          total_price: 1500,
          type: "service" as const,
          category: "review",
        },
      ],
      payment_terms: {
        due_in_days: 30, // Custom payment terms
        payment_methods: ["bank_transfer", "credit_card", "paypal"],
      },
      notes: {
        client_message: "Thank you for your business! Please let us know if you have any questions.",
      },
    };
    
    // Generate invoice number
    const now = new Date();
    const invoiceNumber = `CD-INV-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}/${now.getFullYear().toString().slice(-2)}`;
    
    const invoice: InvoiceSchema = {
      invoice_number: invoiceNumber,
      invoice_date: now.toISOString().split('T')[0],
      due_date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'draft',
      currency: 'USD',
      company: {
        id: exampleOrganization.id,
        name: exampleOrganization.name,
        email: exampleOrganization.email,
        phone: exampleOrganization.phone,
        address: exampleOrganization.address,
        logo_url: exampleOrganization.logo_url,
        tax_id: exampleOrganization.tax_id,
        website: exampleOrganization.website,
      },
      items: customInvoiceData.items,
      summary: {
        subtotal: customInvoiceData.items.reduce((sum, item) => sum + item.total_price, 0),
        total_amount: customInvoiceData.items.reduce((sum, item) => sum + item.total_price, 0),
        balance_due: customInvoiceData.items.reduce((sum, item) => sum + item.total_price, 0),
      },
      payment_terms: customInvoiceData.payment_terms,
      notes: customInvoiceData.notes,
      automation: {
        auto_reminders_enabled: true,
        reminder_schedule: [7, 3, 1],
        late_fee_enabled: false,
      },
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      created_by: 'system',
      organization_id: exampleOrganization.id,
      ...customInvoiceData,
    };
    
    console.log("✅ Custom Invoice Generated:");
    console.log(`   Invoice Number: ${invoice.invoice_number}`);
    console.log(`   Client: ${invoice.client.name}`);
    console.log(`   Total Amount: $${invoice.summary.total_amount.toFixed(2)}`);
    console.log(`   Due in: ${invoice.payment_terms.due_in_days} days`);
    
    return invoice;
  } catch (error) {
    console.error("❌ Error generating custom invoice:", error);
    throw error;
  }
}

/**
 * Example 5: Generate PDF from Invoice
 */
async function generatePDF(invoice: InvoiceSchema, filename: string) {
  console.log("🚀 Generating PDF...");
  
  try {
    const pdfGenerator = new PDFGenerator({
      filename: filename,
      format: 'A4',
      margin: { top: 40, right: 40, bottom: 40, left: 40 },
    });
    
    const pdfBuffer = await pdfGenerator.generatePDF(invoice);
    
    console.log("✅ PDF Generated Successfully:");
    console.log(`   Filename: ${filename}`);
    console.log(`   File Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
    
    return pdfBuffer;
  } catch (error) {
    console.error("❌ Error generating PDF:", error);
    throw error;
  }
}

/**
 * Example 6: Process Payment
 */
async function processPayment(invoice: InvoiceSchema, paymentAmount: number) {
  console.log("🚀 Processing Payment...");
  
  try {
    const updatedInvoice = InvoiceDataMapper.updateInvoiceForPayment(invoice, paymentAmount);
    
    console.log("✅ Payment Processed:");
    console.log(`   Payment Amount: $${paymentAmount.toFixed(2)}`);
    console.log(`   Previous Status: ${invoice.status}`);
    console.log(`   New Status: ${updatedInvoice.status}`);
    console.log(`   Amount Paid: $${updatedInvoice.summary.amount_paid?.toFixed(2)}`);
    console.log(`   Balance Due: $${updatedInvoice.summary.balance_due.toFixed(2)}`);
    
    return updatedInvoice;
  } catch (error) {
    console.error("❌ Error processing payment:", error);
    throw error;
  }
}

/**
 * Main demonstration function
 */
async function runInvoiceAutomationDemo() {
  console.log("🎯 CresOS Invoice Automation System Demo");
  console.log("=" .repeat(50));
  
  try {
    // Example 1: Standard Invoice
    const standardInvoice = await generateStandardInvoice();
    await generatePDF(standardInvoice, `${standardInvoice.invoice_number}.pdf`);
    console.log();
    
    // Example 2: Milestone Invoice
    const milestoneInvoice = await generateMilestoneInvoice();
    await generatePDF(milestoneInvoice, `${milestoneInvoice.invoice_number}.pdf`);
    console.log();
    
    // Example 3: Retainer Invoice
    const retainerInvoice = await generateRetainerInvoice();
    await generatePDF(retainerInvoice, `${retainerInvoice.invoice_number}.pdf`);
    console.log();
    
    // Example 4: Custom Invoice
    const customInvoice = await generateCustomInvoice();
    await generatePDF(customInvoice, `${customInvoice.invoice_number}.pdf`);
    console.log();
    
    // Example 5: Payment Processing
    const paidInvoice = await processPayment(standardInvoice, 8000);
    await generatePDF(paidInvoice, `${paidInvoice.invoice_number}-PAID.pdf`, {
      stamp: 'PAID'
    });
    console.log();
    
    console.log("🎉 Demo completed successfully!");
    console.log("📁 Generated files:");
    console.log("   - Standard invoice PDF");
    console.log("   - Milestone invoice PDF");
    console.log("   - Retainer invoice PDF");
    console.log("   - Custom invoice PDF");
    console.log("   - Paid invoice PDF with stamp");
    
  } catch (error) {
    console.error("❌ Demo failed:", error);
  }
}

/**
 * Invoice Analytics Example
 */
async function demonstrateAnalytics() {
  console.log("📊 Invoice Analytics Demo");
  console.log("-" .repeat(30));
  
  // Sample analytics data
  const sampleAnalytics = {
    total_invoices: 156,
    total_amount: 245678.90,
    paid_amount: 198456.32,
    outstanding_amount: 47222.58,
    overdue_amount: 12450.00,
    average_payment_time: 14.5, // days
    invoices_by_status: {
      draft: 12,
      sent: 23,
      paid: 98,
      overdue: 18,
      cancelled: 5,
    },
    invoices_by_month: [
      { month: "2026-01", count: 12, amount: 18500.00 },
      { month: "2026-02", count: 15, amount: 22300.00 },
      { month: "2026-03", count: 18, amount: 28900.00 },
      { month: "2026-04", count: 14, amount: 19800.00 },
    ],
    top_clients: [
      {
        client_id: "client-456",
        client_name: "Acme Corporation",
        total_invoices: 8,
        total_amount: 45600.00,
      },
      {
        client_id: "client-789",
        client_name: "Tech Startup Inc",
        total_invoices: 6,
        total_amount: 32400.00,
      },
    ],
  };
  
  console.log("📈 Financial Summary:");
  console.log(`   Total Invoices: ${sampleAnalytics.total_invoices}`);
  console.log(`   Total Revenue: $${sampleAnalytics.total_amount.toLocaleString()}`);
  console.log(`   Paid Amount: $${sampleAnalytics.paid_amount.toLocaleString()}`);
  console.log(`   Outstanding: $${sampleAnalytics.outstanding_amount.toLocaleString()}`);
  console.log(`   Overdue: $${sampleAnalytics.overdue_amount.toLocaleString()}`);
  console.log(`   Avg Payment Time: ${sampleAnalytics.average_payment_time} days`);
  
  console.log("\n📊 Invoices by Status:");
  Object.entries(sampleAnalytics.invoices_by_status).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });
  
  console.log("\n📅 Monthly Trends:");
  sampleAnalytics.invoices_by_month.forEach(month => {
    console.log(`   ${month.month}: ${month.count} invoices, $${month.amount.toLocaleString()}`);
  });
  
  console.log("\n🏆 Top Clients:");
  sampleAnalytics.top_clients.forEach((client, index) => {
    console.log(`   ${index + 1}. ${client.client_name}: ${client.total_invoices} invoices, $${client.total_amount.toLocaleString()}`);
  });
}

// Export functions for use in other modules
export {
  generateStandardInvoice,
  generateMilestoneInvoice,
  generateRetainerInvoice,
  generateCustomInvoice,
  generatePDF,
  processPayment,
  demonstrateAnalytics,
  runInvoiceAutomationDemo,
};

// Run demo if this file is executed directly
if (require.main === module) {
  runInvoiceAutomationDemo()
    .then(() => demonstrateAnalytics())
    .catch(console.error);
}

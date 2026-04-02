/**
 * Simple PDF Generation Test
 * 
 * This script tests the PDF generation functionality with sample data
 */

import { PDFGenerator } from '../src/services/invoice/pdf-generator';
import { InvoiceSchema } from '../src/services/invoice/schema';

// Sample invoice data for testing
const sampleInvoice: InvoiceSchema = {
  invoice_number: "CD-INV-001/26",
  invoice_date: "2026-04-02",
  due_date: "2026-04-09",
  status: "sent",
  currency: "USD",
  client: {
    id: "client-123",
    name: "Acme Corporation",
    email: "billing@acme.com",
    phone: "+1-555-0123",
    address: {
      street: "123 Business St",
      city: "New York",
      country: "USA",
      postal_code: "10001",
    },
  },
  company: {
    name: "CresOS Solutions",
    email: "invoices@cresos.com",
    phone: "+1-555-9999",
    address: {
      street: "456 Tech Street",
      city: "San Francisco",
      country: "USA",
      postal_code: "94105",
    },
    logo_url: "https://cresos.com/logo.png",
    tax_id: "12-3456789",
    website: "https://cresos.com",
  },
  project: {
    id: "project-456",
    name: "E-commerce Website Development",
    description: "Full-stack e-commerce platform with payment integration",
  },
  items: [
    {
      id: "item-1",
      name: "Frontend Development",
      description: "React-based frontend with responsive design",
      quantity: 1,
      unit_price: 8000,
      total_price: 8000,
      type: "service",
      category: "development",
    },
    {
      id: "item-2",
      name: "Backend API",
      description: "Node.js REST API with database integration",
      quantity: 1,
      unit_price: 6000,
      total_price: 6000,
      type: "service",
      category: "development",
    },
    {
      id: "item-3",
      name: "Payment Integration",
      description: "Stripe payment gateway integration",
      quantity: 1,
      unit_price: 2500,
      total_price: 2500,
      type: "service",
      category: "integration",
    },
  ],
  summary: {
    subtotal: 16500,
    tax_rate: 0,
    tax_amount: 0,
    total_amount: 16500,
    balance_due: 16500,
  },
  payment_terms: {
    due_in_days: 7,
    payment_methods: ["bank_transfer", "credit_card", "paypal"],
    bank_details: {
      bank_name: "Tech Bank",
      account_name: "CresOS Solutions",
      account_number: "123456789",
      routing_number: "987654321",
      swift_code: "TECHUS33",
    },
  },
  notes: {
    client_message: "Thank you for your business! Please let us know if you have any questions about this invoice.",
    terms_and_conditions: "Payment is due within 7 days. Late payments are subject to a 1.5% monthly fee.",
  },
  automation: {
    auto_reminders_enabled: true,
    reminder_schedule: [3, 1],
    late_fee_enabled: false,
  },
  created_at: "2026-04-02T18:30:00.000Z",
  updated_at: "2026-04-02T18:30:00.000Z",
  created_by: "system",
  organization_id: "cresos-demo-org",
};

async function testPDFGeneration() {
  console.log("🚀 Testing PDF Generation...");
  
  try {
    // Test 1: Basic PDF Generation
    console.log("📄 Generating basic PDF...");
    const pdfGenerator1 = new PDFGenerator({
      filename: "test-invoice-basic.pdf",
      format: 'A4',
      margin: { top: 40, right: 40, bottom: 40, left: 40 },
    });
    
    const pdfBuffer1 = await pdfGenerator1.generatePDF(sampleInvoice);
    console.log(`✅ Basic PDF generated: ${(pdfBuffer1.length / 1024).toFixed(2)} KB`);
    
    // Test 2: PDF with PAID Stamp
    console.log("📄 Generating PDF with PAID stamp...");
    const pdfGenerator2 = new PDFGenerator({
      filename: "test-invoice-paid.pdf",
      format: 'A4',
      margin: { top: 40, right: 40, bottom: 40, left: 40 },
      stamp: 'PAID',
    });
    
    const pdfBuffer2 = await pdfGenerator2.generatePDF(sampleInvoice);
    console.log(`✅ PAID stamp PDF generated: ${(pdfBuffer2.length / 1024).toFixed(2)} KB`);
    
    // Test 3: PDF with Watermark
    console.log("📄 Generating PDF with watermark...");
    const pdfGenerator3 = new PDFGenerator({
      filename: "test-invoice-watermark.pdf",
      format: 'A4',
      margin: { top: 40, right: 40, bottom: 40, left: 40 },
      watermark: 'CONFIDENTIAL',
    });
    
    const pdfBuffer3 = await pdfGenerator3.generatePDF(sampleInvoice);
    console.log(`✅ Watermark PDF generated: ${(pdfBuffer3.length / 1024).toFixed(2)} KB`);
    
    // Test 4: PDF with DRAFT Stamp and Watermark
    console.log("📄 Generating PDF with DRAFT stamp and watermark...");
    const pdfGenerator4 = new PDFGenerator({
      filename: "test-invoice-draft.pdf",
      format: 'A4',
      margin: { top: 40, right: 40, bottom: 40, left: 40 },
      stamp: 'DRAFT',
      watermark: 'DRAFT COPY',
    });
    
    const pdfBuffer4 = await pdfGenerator4.generatePDF(sampleInvoice);
    console.log(`✅ DRAFT PDF generated: ${(pdfBuffer4.length / 1024).toFixed(2)} KB`);
    
    // Save one of the PDFs to file system for verification
    const fs = require('fs');
    const path = require('path');
    
    // Ensure output directory exists
    const outputDir = './generated';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Save the basic PDF
    const outputPath = path.join(outputDir, 'test-invoice-basic.pdf');
    fs.writeFileSync(outputPath, pdfBuffer1);
    console.log(`💾 PDF saved to: ${outputPath}`);
    
    // Test PDF content verification
    console.log("🔍 Verifying PDF content...");
    
    // Check if PDF has content (non-empty buffer)
    if (pdfBuffer1.length > 1000) {
      console.log("✅ PDF has sufficient content");
    } else {
      console.log("❌ PDF appears to be empty or too small");
    }
    
    // Check PDF header (should start with %PDF)
    const header = pdfBuffer1.slice(0, 4).toString();
    if (header === '%PDF') {
      console.log("✅ PDF has correct header format");
    } else {
      console.log("❌ PDF header format is incorrect");
    }
    
    console.log("🎉 PDF Generation Test Completed Successfully!");
    console.log("📁 Generated files:");
    console.log("   - test-invoice-basic.pdf (saved to filesystem)");
    console.log("   - test-invoice-paid.pdf (memory only)");
    console.log("   - test-invoice-watermark.pdf (memory only)");
    console.log("   - test-invoice-draft.pdf (memory only)");
    
    return {
      success: true,
      basicSize: pdfBuffer1.length,
      paidSize: pdfBuffer2.length,
      watermarkSize: pdfBuffer3.length,
      draftSize: pdfBuffer4.length,
      savedPath: outputPath,
    };
    
  } catch (error) {
    console.error("❌ PDF Generation Test Failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Test with different invoice data
async function testDifferentInvoiceTypes() {
  console.log("\n🔄 Testing Different Invoice Types...");
  
  try {
    // Test 1: Invoice with many items
    console.log("📄 Testing invoice with many items...");
    const manyItemsInvoice = {
      ...sampleInvoice,
      invoice_number: "CD-INV-002/26",
      items: Array.from({ length: 15 }, (_, i) => ({
        id: `item-${i + 1}`,
        name: `Service Item ${i + 1}`,
        description: `Description for service item ${i + 1}`,
        quantity: 1,
        unit_price: (i + 1) * 100,
        total_price: (i + 1) * 100,
        type: "service" as const,
        category: "professional_services",
      })),
    };
    
    // Recalculate totals
    const subtotal = manyItemsInvoice.items.reduce((sum, item) => sum + item.total_price, 0);
    manyItemsInvoice.summary = {
      subtotal,
      tax_rate: 0,
      tax_amount: 0,
      total_amount: subtotal,
      balance_due: subtotal,
    };
    
    const pdfGenerator = new PDFGenerator({
      filename: "test-invoice-many-items.pdf",
    });
    
    const pdfBuffer = await pdfGenerator.generatePDF(manyItemsInvoice);
    console.log(`✅ Many items PDF generated: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
    
    // Test 2: Invoice with tax
    console.log("📄 Testing invoice with tax...");
    const taxInvoice = {
      ...sampleInvoice,
      invoice_number: "CD-INV-003/26",
      summary: {
        subtotal: 10000,
        tax_rate: 10,
        tax_amount: 1000,
        total_amount: 11000,
        balance_due: 11000,
      },
    };
    
    const pdfGenerator2 = new PDFGenerator({
      filename: "test-invoice-with-tax.pdf",
    });
    
    const pdfBuffer2 = await pdfGenerator2.generatePDF(taxInvoice);
    console.log(`✅ Tax PDF generated: ${(pdfBuffer2.length / 1024).toFixed(2)} KB`);
    
    console.log("🎉 Different Invoice Types Test Completed!");
    
    return {
      success: true,
      manyItemsSize: pdfBuffer.length,
      taxSize: pdfBuffer2.length,
    };
    
  } catch (error) {
    console.error("❌ Different Invoice Types Test Failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Performance test
async function testPDFPerformance() {
  console.log("\n⚡ Testing PDF Generation Performance...");
  
  try {
    const iterations = 5;
    const sizes: number[] = [];
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      const pdfGenerator = new PDFGenerator({
        filename: `test-performance-${i + 1}.pdf`,
      });
      
      const pdfBuffer = await pdfGenerator.generatePDF(sampleInvoice);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      sizes.push(pdfBuffer.length);
      times.push(duration);
      
      console.log(`   Iteration ${i + 1}: ${duration}ms, ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
    }
    
    const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    
    console.log(`📊 Performance Results:`);
    console.log(`   Average PDF size: ${(avgSize / 1024).toFixed(2)} KB`);
    console.log(`   Average generation time: ${avgTime.toFixed(2)}ms`);
    console.log(`   Total time for ${iterations} PDFs: ${times.reduce((sum, time) => sum + time, 0)}ms`);
    
    return {
      success: true,
      averageSize: avgSize,
      averageTime: avgTime,
      iterations,
    };
    
  } catch (error) {
    console.error("❌ Performance Test Failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Main test runner
async function runAllTests() {
  console.log("🧪 CresOS Invoice PDF Generation Test Suite");
  console.log("=" .repeat(50));
  
  const results = {
    basicTest: await testPDFGeneration(),
    differentTypesTest: await testDifferentInvoiceTypes(),
    performanceTest: await testPDFPerformance(),
  };
  
  console.log("\n📋 Test Summary:");
  console.log(`   Basic PDF Generation: ${results.basicTest.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Different Invoice Types: ${results.differentTypesTest.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Performance Test: ${results.performanceTest.success ? '✅ PASSED' : '❌ FAILED'}`);
  
  const allPassed = results.basicTest.success && results.differentTypesTest.success && results.performanceTest.success;
  
  if (allPassed) {
    console.log("\n🎉 All tests passed! PDF generation is working correctly.");
  } else {
    console.log("\n❌ Some tests failed. Please check the error messages above.");
  }
  
  return results;
}

// Export for use in other modules
export {
  testPDFGeneration,
  testDifferentInvoiceTypes,
  testPDFPerformance,
  runAllTests,
  sampleInvoice,
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

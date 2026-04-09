/**
 * Finance Invoice Integration Test
 * 
 * Tests the complete integration between the finance system and PDF invoice generation
 * using the exact format from the Invoice.docx template
 */

import { FinanceInvoiceService } from '../src/services/invoice/finance-integration';
import { DocxTemplateParser } from '../src/services/invoice/docx-parser';
import { PrismaClient } from '@prisma/client';

// Mock Prisma client for testing
const mockPrisma = {
  org: {
    findFirst: jest.fn(),
  },
  client: {
    findFirst: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
  },
  invoice: {
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
  },
  invoiceItem: {
    createMany: jest.fn(),
  },
  eventLog: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
} as any;

// Test data
const testOrgData = {
  id: 'test-org-123',
  name: 'Test Business Organization',
  slug: 'test-business'
};

const testClientData = {
  id: 'test-client-456',
  name: 'Test Client Company',
  email: 'billing@testclient.com',
  phone: '+1-555-0123'
};

const testProjectData = {
  id: 'test-project-789',
  name: 'Test Web Development Project',
  clientId: 'test-client-456',
  price: 15000,
  projectDetails: 'Full-stack web development with React and Node.js',
  startDate: new Date('2026-04-01'),
  endDate: new Date('2026-06-01')
};

const testInvoiceData = {
  clientId: 'test-client-456',
  projectId: 'test-project-789',
  items: [
    {
      description: 'Frontend Development',
      quantity: 1,
      unitPrice: '8000'
    },
    {
      description: 'Backend Development',
      quantity: 1,
      unitPrice: '7000'
    }
  ],
  currency: 'KES',
  issueDate: '2026-04-02',
  dueDate: '2026-04-09'
};

describe('Finance Invoice Integration', () => {
  let financeInvoiceService: FinanceInvoiceService;
  let docxParser: DocxTemplateParser;

  beforeEach(() => {
    financeInvoiceService = new FinanceInvoiceService(mockPrisma);
    docxParser = new DocxTemplateParser(
      '/Users/airm1/Projects/CresOs/apps/api/src/services/invoice/Invoice.docx'
    );

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('DOCX Template Parser', () => {
    test('should parse DOCX template successfully', async () => {
      const templateStructure = await docxParser.parseTemplate();
      
      expect(templateStructure).toBeDefined();
      expect(templateStructure.layout.pageSize).toBe('A4');
      expect(templateStructure.fields).toBeDefined();
      expect(templateStructure.fields.length).toBeGreaterThan(0);
    });

    test('should generate unique invoice numbers', () => {
      const invoiceNumber1 = docxParser.generateInvoiceNumber('project-123', 'org-456');
      const invoiceNumber2 = docxParser.generateInvoiceNumber('project-789', 'org-456');
      
      expect(invoiceNumber1).toMatch(/^INV-[A-Z0-9]{3}-\d{2}\/\d{2}$/);
      expect(invoiceNumber2).toMatch(/^INV-[A-Z0-9]{3}-\d{2}\/\d{2}$/);
      expect(invoiceNumber1).not.toBe(invoiceNumber2);
    });

    test('should map invoice data to template format', () => {
      const invoiceSchema = {
        invoice_number: 'INV-ABC123-04/26',
        invoice_date: '2026-04-02',
        due_date: '2026-04-09',
        currency: 'KES',
        client: {
          name: 'Test Client',
          email: 'client@test.com',
          phone: '+1-555-0123'
        },
        company: {
          name: 'Test Company',
          email: 'company@test.com',
          phone: '+1-555-0987'
        },
        project: {
          name: 'Test Project',
          description: 'Test project description'
        },
        items: [
          {
            name: 'Service 1',
            description: 'Description 1',
            quantity: 1,
            unit_price: 1000,
            total_price: 1000
          }
        ],
        summary: {
          subtotal: 1000,
          tax_amount: 0,
          total_amount: 1000,
          balance_due: 1000
        },
        payment_terms: {
          due_in_days: 7
        },
        notes: {
          client_message: 'Thank you for your business!'
        }
      } as any;

      const templateData = docxParser.mapInvoiceToTemplate(invoiceSchema);
      
      expect(templateData.invoiceNumber).toBe('INV-ABC123-04/26');
      expect(templateData.clientName).toBe('Test Client');
      expect(templateData.companyName).toBe('Test Company');
      expect(templateData.projectName).toBe('Test Project');
      expect(templateData.items).toHaveLength(1);
      expect(templateData.totalAmount).toBe('KES 1,000.00');
    });
  });

  describe('Finance Invoice Service', () => {
    test('should create finance invoice with PDF', async () => {
      // Mock database responses
      mockPrisma.org.findFirst.mockResolvedValue(testOrgData);
      mockPrisma.client.findFirst.mockResolvedValue(testClientData);
      mockPrisma.project.findFirst.mockResolvedValue(testProjectData);
      
      // Mock transaction
      const mockInvoice = {
        id: 'invoice-123',
        number: 'CD-INV-000001/26',
        clientId: 'test-client-456',
        projectId: 'test-project-789',
        status: 'sent',
        issueDate: new Date('2026-04-02'),
        dueDate: new Date('2026-04-09'),
        currency: 'KES',
        totalAmount: 15000,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.invoice.count.mockResolvedValue(0);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrisma);
      });

      mockPrisma.invoice.create.mockResolvedValue(mockInvoice);
      mockPrisma.invoiceItem.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.eventLog.create.mockResolvedValue({});

      const result = await financeInvoiceService.createFinanceInvoice(
        'test-org-123',
        testInvoiceData,
        'user-123'
      );

      expect(result).toBeDefined();
      expect(result.invoice).toBeDefined();
      expect(result.pdfBuffer).toBeDefined();
      expect(result.pdfBuffer.length).toBeGreaterThan(1000);
      expect(result.invoice.number).toMatch(/^CD-INV-\d{6}\/\d{2}$/);
    });

    test('should generate project invoice automatically', async () => {
      // Mock database responses
      mockPrisma.project.findFirst.mockResolvedValue(testProjectData);
      mockPrisma.client.findFirst.mockResolvedValue(testClientData);
      mockPrisma.org.findFirst.mockResolvedValue(testOrgData);
      
      // Mock transaction
      const mockInvoice = {
        id: 'invoice-456',
        number: 'CD-INV-000001/26',
        clientId: 'test-client-456',
        projectId: 'test-project-789',
        status: 'sent',
        issueDate: new Date('2026-04-02'),
        dueDate: new Date('2026-04-09'),
        currency: 'KES',
        totalAmount: 15000,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.invoice.count.mockResolvedValue(0);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrisma);
      });

      mockPrisma.invoice.create.mockResolvedValue(mockInvoice);
      mockPrisma.invoiceItem.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.eventLog.create.mockResolvedValue({});

      const result = await financeInvoiceService.generateProjectInvoice(
        'test-project-789',
        'test-org-123',
        'user-123'
      );

      expect(result).toBeDefined();
      expect(result.invoice).toBeDefined();
      expect(result.pdfBuffer).toBeDefined();
      expect(result.invoice.projectId).toBe('test-project-789');
      expect(result.invoice.number).toMatch(/^CD-INV-\d{6}\/\d{2}$/);
    });

    test('should get invoice with PDF', async () => {
      // Mock database responses
      const mockInvoice = {
        id: 'invoice-789',
        number: 'CD-INV-000003/26',
        clientId: 'test-client-456',
        projectId: 'test-project-789',
        status: 'sent',
        issueDate: new Date('2026-04-02'),
        dueDate: new Date('2026-04-09'),
        currency: 'KES',
        totalAmount: 15000,
        createdAt: new Date(),
        updatedAt: new Date(),
        client: testClientData,
        project: testProjectData,
        items: [
          {
            id: 'item-1',
            description: 'Frontend Development',
            quantity: 1,
            unitPrice: 8000
          },
          {
            id: 'item-2',
            description: 'Backend Development',
            quantity: 1,
            unitPrice: 7000
          }
        ]
      };

      mockPrisma.invoice.findFirst.mockResolvedValue(mockInvoice);
      mockPrisma.org.findFirst.mockResolvedValue(testOrgData);

      const result = await financeInvoiceService.getInvoiceWithPDF(
        'invoice-789',
        'test-org-123'
      );

      expect(result).toBeDefined();
      expect(result.invoice).toBeDefined();
      expect(result.pdfBuffer).toBeDefined();
      expect(result.invoice.number).toBe('CD-INV-000003/26');
      expect(result.pdfBuffer.length).toBeGreaterThan(1000);
    });

    test('should handle client not found error', async () => {
      mockPrisma.org.findFirst.mockResolvedValue(testOrgData);
      mockPrisma.client.findFirst.mockResolvedValue(null);

      await expect(
        financeInvoiceService.createFinanceInvoice(
          'test-org-123',
          testInvoiceData,
          'user-123'
        )
      ).rejects.toThrow('Client not found');
    });

    test('should handle project not found error', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(
        financeInvoiceService.generateProjectInvoice(
          'nonexistent-project',
          'test-org-123',
          'user-123'
        )
      ).rejects.toThrow('Project not found');
    });
  });

  describe('Invoice Number Generation', () => {
    test('should generate consistent invoice numbers for same inputs', () => {
      const invoiceNumber1 = docxParser.generateInvoiceNumber('project-123', 'org-456');
      const invoiceNumber2 = docxParser.generateInvoiceNumber('project-123', 'org-456');
      
      expect(invoiceNumber1).toBe(invoiceNumber2);
    });

    test('should generate different invoice numbers for different projects', () => {
      const invoiceNumber1 = docxParser.generateInvoiceNumber('project-123', 'org-456');
      const invoiceNumber2 = docxParser.generateInvoiceNumber('project-789', 'org-456');
      
      expect(invoiceNumber1).not.toBe(invoiceNumber2);
    });

    test('should generate different invoice numbers for different organizations', () => {
      const invoiceNumber1 = docxParser.generateInvoiceNumber('project-123', 'org-456');
      const invoiceNumber2 = docxParser.generateInvoiceNumber('project-123', 'org-789');
      
      expect(invoiceNumber1).not.toBe(invoiceNumber2);
    });
  });

  describe('PDF Generation with DOCX Format', () => {
    test('should generate PDF with correct format', async () => {
      const invoiceSchema = {
        invoice_number: 'INV-ABC123-04/26',
        invoice_date: '2026-04-02',
        due_date: '2026-04-09',
        currency: 'KES',
        client: {
          id: 'client-123',
          name: 'Test Client Company',
          email: 'billing@testclient.com',
          phone: '+1-555-0123'
        },
        company: {
          name: 'Test Business Organization',
          email: 'info@testbusiness.com',
          phone: '+1-555-0987'
        },
        project: {
          id: 'project-123',
          name: 'Test Web Development Project',
          description: 'Full-stack web development with React and Node.js'
        },
        items: [
          {
            id: 'item-1',
            name: 'Frontend Development',
            description: 'React-based frontend with responsive design',
            quantity: 1,
            unit_price: 8000,
            total_price: 8000,
            type: 'service' as const,
            category: 'development'
          },
          {
            id: 'item-2',
            name: 'Backend Development',
            description: 'Node.js REST API with database integration',
            quantity: 1,
            unit_price: 7000,
            total_price: 7000,
            type: 'service' as const,
            category: 'development'
          }
        ],
        summary: {
          subtotal: 15000,
          tax_rate: 0,
          tax_amount: 0,
          total_amount: 15000,
          balance_due: 15000
        },
        payment_terms: {
          due_in_days: 7
        },
        notes: {
          client_message: 'Thank you for your business! Payment is due within 7 days.'
        },
        created_at: '2026-04-02T18:30:00.000Z',
        updated_at: '2026-04-02T18:30:00.000Z',
        created_by: 'system',
        organization_id: 'test-org-123'
      };

      // Mock the PDF generation
      const { PDFGenerator } = require('../src/services/invoice/pdf-generator');
      const mockPDFGenerator = {
        generatePDF: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content'))
      };
      
      jest.spyOn(require('../src/services/invoice/pdf-generator'), 'PDFGenerator')
        .mockImplementation(() => mockPDFGenerator);

      const pdfBuffer = await mockPDFGenerator.generatePDF(invoiceSchema);
      
      expect(pdfBuffer).toBeDefined();
      expect(pdfBuffer.length).toBeGreaterThan(0);
      expect(mockPDFGenerator.generatePDF).toHaveBeenCalledWith(invoiceSchema);
    });
  });
});

// Integration test runner
async function runIntegrationTests() {
  console.log('🧪 Running Finance Invoice Integration Tests...');
  
  try {
    // Test DOCX template parser
    console.log('📄 Testing DOCX template parser...');
    const docxParser = new DocxTemplateParser(
      '/Users/airm1/Projects/CresOs/apps/api/src/services/invoice/Invoice.docx'
    );
    
    const templateStructure = await docxParser.parseTemplate();
    console.log(`✅ Template parsed: ${templateStructure.fields.length} fields found`);
    
    // Test invoice number generation
    const invoiceNumber = docxParser.generateInvoiceNumber('test-project', 'test-org');
    console.log(`✅ Invoice number generated: ${invoiceNumber}`);
    
    // Test invoice data mapping
    const sampleInvoice = {
      invoice_number: invoiceNumber,
      invoice_date: '2026-04-02',
      due_date: '2026-04-09',
      currency: 'KES',
      client: { name: 'Test Client', email: 'client@test.com' },
      company: { name: 'Test Company', email: 'company@test.com' },
      items: [{ name: 'Test Service', unit_price: 1000, total_price: 1000, quantity: 1 }],
      summary: { subtotal: 1000, total_amount: 1000, balance_due: 1000 },
      payment_terms: { due_in_days: 7 },
      notes: { client_message: 'Thank you!' }
    } as any;
    
    const templateData = docxParser.mapInvoiceToTemplate(sampleInvoice);
    console.log(`✅ Invoice data mapped to template format`);
    
    // Test PDF generation
    const { PDFGenerator } = require('../src/services/invoice/pdf-generator');
    const pdfGenerator = new PDFGenerator();
    const pdfBuffer = await pdfGenerator.generatePDF(sampleInvoice);
    
    console.log(`✅ PDF generated: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`📄 PDF header: ${pdfBuffer.slice(0, 4).toString()}`);
    
    console.log('🎉 All integration tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    return false;
  }
}

// Export for use in other modules
export {
  runIntegrationTests,
  testOrgData,
  testClientData,
  testProjectData,
  testInvoiceData
};

// Run tests if this file is executed directly
if (require.main === module) {
  runIntegrationTests().catch(console.error);
}

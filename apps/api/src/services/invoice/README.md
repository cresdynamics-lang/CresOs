# CresOS Invoice Automation System

A comprehensive, production-ready invoice automation system for the CresOS SaaS platform. This system replaces traditional DOCX templates with a flexible JSON-based approach and provides automated invoice generation, PDF creation, and financial analytics.

## 🚀 Features

### Core Functionality
- **Automated Invoice Generation**: Generate invoices automatically when projects are created or milestones are completed
- **JSON-Based Templates**: Flexible, maintainable JSON templates instead of rigid DOCX files
- **PDF Generation**: High-quality PDF generation using PDFKit
- **Multiple Invoice Types**: Support for standard, milestone-based, and retainer invoices
- **Smart Calculations**: Automatic invoice numbering, due dates, taxes, and totals

### Advanced Features
- **Payment Processing**: Track payments and update invoice status automatically
- **Automated Reminders**: Configurable reminder schedules for overdue invoices
- **Late Fee Management**: Automatic late fee application on overdue invoices
- **Financial Analytics**: Comprehensive reporting and insights
- **Multi-Currency Support**: Handle multiple currencies with proper formatting

### Integration Features
- **Database Integration**: Full integration with existing Prisma/PostgreSQL setup
- **API-First Design**: RESTful APIs for all invoice operations
- **Role-Based Access**: Secure access control with existing authentication system
- **Event Logging**: Complete audit trail for all invoice operations

## 📋 System Overview

### Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend UI   │◄──►│   Invoice API    │◄──►│   Database      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   PDF Generator │
                       └─────────────────┘
```

### Key Components

1. **Schema Layer** (`schema.ts`)
   - TypeScript interfaces for all invoice-related data structures
   - Comprehensive type safety and validation

2. **Data Mapping** (`mapper.ts`)
   - Maps project/client data to invoice format
   - Handles different invoice types (standard, milestone, retainer)

3. **Calculators** (`calculators.ts`)
   - Invoice number generation with customizable formats
   - Due date calculation with business day support
   - Tax calculation with location-based rules

4. **PDF Generator** (`pdf-generator.ts`)
   - Professional PDF generation using PDFKit
   - Customizable layouts and styling
   - Support for watermarks, stamps, and branding

5. **Automation Service** (`automation.ts`)
   - Core business logic for invoice automation
   - Integration with database and external services
   - Handles payment processing and reminders

6. **API Routes** (`invoice-automation.ts`)
   - RESTful endpoints for all invoice operations
   - Role-based access control
   - Comprehensive error handling

## 🛠 Installation & Setup

### Dependencies

```bash
npm install pdfkit @types/pdfkit
npm install multer @types/multer
```

### Database Schema

The system uses the existing Prisma schema with these key models:

```prisma
model Invoice {
  id          String          @id @default(cuid())
  orgId       String
  clientId    String
  projectId   String?
  number      String
  status      String          // draft, sent, partial, paid, overdue, cancelled
  issueDate   DateTime
  dueDate     DateTime?
  currency    String          @default("USD")
  totalAmount Decimal         @db.Decimal(14, 2)
  // ... other fields
}

model InvoiceItem {
  id          String          @id @default(cuid())
  invoiceId   String
  description String
  quantity    Int             @default(1)
  unitPrice   Decimal         @db.Decimal(14, 2)
  // ... other fields
}
```

### Configuration

Create a default configuration for your organization:

```typescript
const config: InvoiceAutomationConfig = {
  organization_id: "your-org-id",
  invoice_number: {
    prefix: "CD-INV",
    format: "{seq:3}/{year:2}",
    separator: "-",
    reset_frequency: "yearly",
  },
  due_date: {
    default_days: 7,
    business_days_only: false,
  },
  tax: {
    default_rate: 0,
  },
  automation: {
    auto_generate_on_project_create: false,
    auto_generate_on_milestone_complete: true,
    auto_send_invoice: false,
    auto_reminders: {
      enabled: true,
      schedule: [3, 1], // 3 days and 1 day before due
    },
  },
};
```

## 📊 Invoice JSON Schema

The system uses a comprehensive JSON schema that replaces traditional DOCX templates:

```json
{
  "invoice_number": "CD-INV-001/26",
  "invoice_date": "2026-04-02",
  "due_date": "2026-04-09",
  "status": "sent",
  "currency": "USD",
  "client": {
    "id": "client-123",
    "name": "Acme Corporation",
    "email": "billing@acme.com",
    "address": {
      "street": "123 Business St",
      "city": "New York",
      "country": "USA",
      "postal_code": "10001"
    }
  },
  "company": {
    "id": "company-456",
    "name": "CresOS",
    "email": "invoices@cresos.com",
    "logo_url": "https://cresos.com/logo.png"
  },
  "items": [
    {
      "id": "item-1",
      "name": "Website Development",
      "description": "Full-stack web application development",
      "quantity": 1,
      "unit_price": 5000,
      "total_price": 5000,
      "type": "service"
    }
  ],
  "summary": {
    "subtotal": 5000,
    "tax_amount": 0,
    "total_amount": 5000,
    "balance_due": 5000
  },
  "payment_terms": {
    "due_in_days": 7,
    "payment_methods": ["bank_transfer", "credit_card"]
  }
}
```

## 🔧 API Usage

### Generate Invoice for Project

```typescript
POST /api/invoice-automation/generate/project/:projectId
Content-Type: application/json

{
  "type": "standard", // "standard" | "milestone" | "retainer"
  "milestoneId": "milestone-123" // Required for milestone type
}
```

### Generate Custom Invoice

```typescript
POST /api/invoice-automation/generate/custom
Content-Type: application/json

{
  "client": {
    "id": "client-123",
    "name": "Acme Corporation",
    "email": "billing@acme.com"
  },
  "items": [
    {
      "name": "Consulting Services",
      "quantity": 10,
      "unit_price": 150
    }
  ],
  "payment_terms": {
    "due_in_days": 30
  }
}
```

### Generate PDF

```typescript
POST /api/invoice-automation/:invoiceId/pdf
Content-Type: application/json

{
  "stamp": "PAID",
  "watermark": "CONFIDENTIAL"
}
```

### Process Payment

```typescript
POST /api/invoice-automation/:invoiceId/payment
Content-Type: application/json

{
  "amount": 2500.00
}
```

### Get Analytics

```typescript
GET /api/invoice-automation/analytics?startDate=2026-01-01&endDate=2026-12-31
```

## 🎯 Invoice Types

### 1. Standard Invoices
Generated for complete projects or one-time services.

### 2. Milestone-Based Invoices
Generated when specific project milestones are completed.

```typescript
// Generate milestone invoice
await automationService.generateMilestoneInvoice(projectId, milestoneId);
```

### 3. Retainer Invoices
Monthly recurring invoices for ongoing services.

```typescript
// Generate retainer invoice
await automationService.generateRetainerInvoice(projectId);
```

## 📈 Automation Features

### Auto-Generation

Configure automatic invoice generation:

```typescript
const config = {
  automation: {
    auto_generate_on_project_create: true,
    auto_generate_on_milestone_complete: true,
    auto_send_invoice: false, // Send manually for review
  }
};
```

### Payment Processing

Track and process payments:

```typescript
// Process payment
const updatedInvoice = await automationService.processInvoicePayment(
  invoiceId, 
  paymentAmount
);

// Invoice status automatically updated:
// - "sent" → "partial" (if partial payment)
// - "sent" → "paid" (if full payment)
```

### Automated Reminders

Configure reminder schedules:

```typescript
const config = {
  automation: {
    auto_reminders: {
      enabled: true,
      schedule: [7, 3, 1], // Days before due date
    },
  }
};
```

### Late Fee Management

Automatic late fee application:

```typescript
// Apply late fees to all overdue invoices
await automationService.applyLateFees();

// Late fees calculated as: balance_due * 1.5%
```

## 🎨 PDF Generation

### Custom Styling

The PDF generator supports professional styling:

```typescript
const pdfGenerator = new PDFGenerator({
  format: 'A4',
  margin: { top: 40, right: 40, bottom: 40, left: 40 },
  stamp: 'PAID',
  watermark: 'CONFIDENTIAL'
});

const pdfBuffer = await pdfGenerator.generatePDF(invoice);
```

### PDF Features

- **Professional Layout**: Clean, business-ready invoice design
- **Custom Branding**: Logo, colors, and fonts
- **Multi-Page Support**: Automatic page breaks for long invoices
- **Stamps & Watermarks**: "PAID", "DRAFT", "OVERDUE" stamps
- **Currency Formatting**: Proper currency symbol placement
- **Table Formatting**: Professional item tables with alternating row colors

## 📊 Analytics & Reporting

### Financial Analytics

Get comprehensive financial insights:

```typescript
const analytics = await automationService.getInvoiceAnalytics({
  start: new Date('2026-01-01'),
  end: new Date('2026-12-31')
});

// Returns:
// - Total invoices and amounts
// - Paid vs outstanding amounts
// - Average payment times
// - Monthly trends
// - Top clients by revenue
```

### Key Metrics

- **Total Revenue**: Sum of all paid invoices
- **Outstanding Amount**: Total unpaid invoices
- **Overdue Amount**: Total overdue invoices
- **Average Payment Time**: Days from invoice sent to payment
- **Client Rankings**: Top clients by revenue

## 🔒 Security & Access Control

### Role-Based Permissions

- **Finance**: Full invoice management access
- **Admin**: Configuration and system management
- **Director**: View-only access to analytics
- **Analyst**: Limited access to reports

### Data Protection

- All invoice data encrypted at rest
- Secure PDF generation with watermarks
- Audit trail for all operations
- Role-based API access

## 🚀 Production Deployment

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost/cresos

# Email Service (for invoice delivery)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@cresos.com
SMTP_PASS=your-app-password

# File Storage
UPLOAD_PATH=./uploads
GENERATED_PATH=./generated

# Invoice Configuration
DEFAULT_CURRENCY=USD
DEFAULT_PAYMENT_TERMS=7
LATE_FEE_PERCENTAGE=1.5
```

### Monitoring & Logging

- Structured logging for all operations
- Error tracking and alerting
- Performance metrics for PDF generation
- Invoice delivery status tracking

## 🔄 Migration from DOCX

The system includes migration utilities to convert existing DOCX templates:

```typescript
// Convert DOCX template to JSON schema
const jsonTemplate = await convertDocxToJsonTemplate(docxFilePath);

// Validate template structure
const validation = validateInvoiceTemplate(jsonTemplate);

// Save new template
await saveInvoiceTemplate(jsonTemplate);
```

## 🎯 Best Practices

### Invoice Numbering

Use consistent, sequential numbering:

```typescript
const config = {
  invoice_number: {
    prefix: "CD-INV",
    format: "{seq:3}/{year:2}", // CD-INV-001/26
    separator: "-",
    reset_frequency: "yearly",
  }
};
```

### Payment Terms

Set clear payment terms:

```typescript
const config = {
  due_date: {
    default_days: 7, // As requested: 7 days after invoice date
    business_days_only: false,
  }
};
```

### Tax Configuration

Configure tax rules by location:

```typescript
const config = {
  tax: {
    default_rate: 0,
    tax_rules: [
      {
        client_location: "EU",
        service_type: "digital",
        rate: 21.0
      }
    ]
  }
};
```

## 🐛 Troubleshooting

### Common Issues

1. **PDF Generation Fails**
   - Check PDFKit installation
   - Verify font availability
   - Check file permissions

2. **Invoice Number Conflicts**
   - Ensure sequence is loaded from database
   - Check reset frequency settings

3. **Email Delivery Issues**
   - Verify SMTP configuration
   - Check email templates
   - Review spam filter settings

### Debug Mode

Enable detailed logging:

```typescript
const automationService = new InvoiceAutomationService(prisma, config, {
  debug: true,
  logLevel: 'verbose'
});
```

## 📞 Support

For issues and questions:
- Check the error logs in the console
- Review the API documentation
- Verify database schema alignment
- Test with sample data first

## 🔄 Future Enhancements

Planned features for next releases:
- **Multi-Language Support**: Invoice templates in multiple languages
- **Advanced Tax Engine**: Complex tax calculation rules
- **Payment Gateway Integration**: Direct payment processing
- **Mobile App**: Native mobile invoice management
- **AI-Powered Insights**: Predictive analytics for cash flow
- **Blockchain Integration**: Immutable invoice records

---

**CresOS Invoice Automation System** - Transform your financial operations with intelligent, automated invoice management.

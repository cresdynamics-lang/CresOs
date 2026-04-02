import type { PrismaClient } from '@prisma/client';
import { InvoiceGenerator } from './generator';
import { InvoiceDataMapper } from './data-mapper';
import { InvoiceData, GeneratedInvoice } from './types';

export class InvoiceService {
  private prisma: PrismaClient;
  private generator: InvoiceGenerator;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.generator = new InvoiceGenerator();
  }

  async generateInvoiceFromFinanceRequest(
    financeRequestId: string,
    templateId: string = 'default'
  ): Promise<GeneratedInvoice> {
    try {
      // Get the finance request
      const financeRequest = await this.prisma.approval.findFirst({
        where: {
          id: financeRequestId,
          entityType: 'finance_request',
        },
        include: {
          requester: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      if (!financeRequest) {
        throw new Error('Finance request not found');
      }

      // Get organization details
      const organization = await this.prisma.org.findFirst({
        where: { id: financeRequest.orgId },
        select: {
          id: true,
          name: true,
          slug: true,
        }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      // Extract client and project information from the finance request
      // Note: In the current schema, Approval doesn't have a metadata field
      // We'll need to handle this differently - perhaps through a related entity
      const clientId = financeRequest.entityId; // Assuming entityId is the clientId for finance requests
      const projectId = null; // Would need to be determined from context

      if (!clientId) {
        throw new Error('Client ID is required for invoice generation');
      }

      // Get client details
      const client = await this.prisma.client.findFirst({
        where: {
          id: clientId,
          orgId: financeRequest.orgId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        }
      });

      if (!client) {
        throw new Error('Client not found');
      }

      // Get project details if available
      let project = null;
      if (projectId) {
        project = await this.prisma.project.findFirst({
          where: {
            id: projectId,
            orgId: financeRequest.orgId,
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            projectDetails: true,
            milestones: {
              select: {
                name: true,
                acceptanceCriteria: true,
              }
            }
          }
        });
      }

      // Map finance request to invoice data
      const invoiceData = InvoiceDataMapper.mapFromFinanceRequest(
        financeRequest, // Pass the approval object instead of metadata
        organization,
        client,
        project
      );

      // Get template
      const template = await this.generator.getTemplate(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Generate the invoice document
      const generatedInvoice = await this.generator.generateInvoice(template, invoiceData);

      // Create invoice record in database
      await this.createInvoiceRecord(generatedInvoice, financeRequest);

      // Log the event
      await this.prisma.eventLog.create({
        data: {
          orgId: financeRequest.orgId,
          type: 'invoice.generated',
          entityType: 'invoice',
          entityId: generatedInvoice.id,
          metadata: {
            financeRequestId,
            templateId,
            invoiceNumber: invoiceData.invoiceNumber,
            clientId: client.id,
            totalAmount: invoiceData.totalAmount,
          }
        }
      });

      return generatedInvoice;
    } catch (error) {
      console.error('Error generating invoice from finance request:', error);
      throw error;
    }
  }

  private async createInvoiceRecord(
    generatedInvoice: GeneratedInvoice,
    financeRequest: any
  ): Promise<void> {
    const invoiceData = generatedInvoice.data;
    const clientId = financeRequest.entityId; // Using entityId as clientId

    // Create invoice in database
    const invoice = await this.prisma.invoice.create({
      data: {
        orgId: financeRequest.orgId,
        clientId: clientId,
        projectId: null, // Would need to be determined from context
        number: invoiceData.invoiceNumber,
        status: 'sent',
        issueDate: invoiceData.issueDate,
        dueDate: invoiceData.dueDate || null,
        currency: invoiceData.currency,
        totalAmount: invoiceData.totalAmount,
      }
    });

    // Create invoice items
    await this.prisma.invoiceItem.createMany({
      data: invoiceData.items.map(item => ({
        invoiceId: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }))
    });

    // Update the generated invoice with the database ID
    generatedInvoice.id = invoice.id;
  }

  async getInvoiceTemplates(): Promise<any[]> {
    return await this.generator.listTemplates();
  }

  async uploadInvoiceTemplate(
    templateName: string,
    docxFilePath: string
  ): Promise<any> {
    return await this.generator.createTemplateFromDocx(templateName, docxFilePath);
  }

  async generateInvoiceForClient(
    clientId: string,
    orgId: string,
    invoiceData: Partial<InvoiceData>,
    templateId: string = 'default'
  ): Promise<GeneratedInvoice> {
    try {
      // Get client details
      const client = await this.prisma.client.findFirst({
        where: {
          id: clientId,
          orgId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        }
      });

      if (!client) {
        throw new Error('Client not found');
      }

      // Get organization details
      const organization = await this.prisma.org.findFirst({
        where: { id: orgId },
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          email: true,
        }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      // Complete invoice data with client and organization info
      const completeInvoiceData: InvoiceData = {
        invoiceNumber: invoiceData.invoiceNumber || this.generateInvoiceNumber(),
        clientName: client.name,
        clientEmail: client.email || undefined,
        clientPhone: client.phone || undefined,
        clientAddress: undefined, // Not available in schema
        companyName: organization.name,
        companyAddress: undefined, // Not available in schema
        companyPhone: undefined, // Not available in schema
        companyEmail: undefined, // Not available in schema
        currency: invoiceData.currency || 'KES',
        issueDate: invoiceData.issueDate || new Date(),
        dueDate: invoiceData.dueDate,
        items: invoiceData.items || [],
        subtotal: invoiceData.subtotal || 0,
        taxRate: invoiceData.taxRate,
        taxAmount: invoiceData.taxAmount,
        totalAmount: invoiceData.totalAmount || 0,
        notes: invoiceData.notes,
        paymentTerms: invoiceData.paymentTerms,
        projectTitle: invoiceData.projectTitle,
        projectDescription: invoiceData.projectDescription,
      };

      // Get template
      const template = await this.generator.getTemplate(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Generate the invoice document
      const generatedInvoice = await this.generator.generateInvoice(template, completeInvoiceData);

      // Create invoice record in database
      await this.prisma.invoice.create({
        data: {
          orgId,
          clientId,
          projectId: invoiceData.projectTitle ? null : null, // Would need project mapping
          number: completeInvoiceData.invoiceNumber,
          status: 'sent',
          issueDate: completeInvoiceData.issueDate,
          dueDate: completeInvoiceData.dueDate || null,
          currency: completeInvoiceData.currency,
          totalAmount: completeInvoiceData.totalAmount,
        }
      });

      // Create invoice items
      const invoice = await this.prisma.invoice.findFirst({
        where: {
          orgId,
          number: completeInvoiceData.invoiceNumber,
        },
        select: { id: true }
      });

      if (invoice) {
        await this.prisma.invoiceItem.createMany({
          data: completeInvoiceData.items.map(item => ({
            invoiceId: invoice.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          }))
        });
      }

      return generatedInvoice;
    } catch (error) {
      console.error('Error generating invoice for client:', error);
      throw error;
    }
  }

  private generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const sequence = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    return `INV-${year}${month}-${sequence}`;
  }

  async getGeneratedInvoice(invoiceId: string, orgId: string): Promise<any> {
    try {
      const invoice = await this.prisma.invoice.findFirst({
        where: {
          id: invoiceId,
          orgId,
          deletedAt: null,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            }
          },
          project: {
            select: {
              id: true,
              name: true,
              projectDetails: true,
            }
          },
          items: true,
        }
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Get client details separately
      const client = await this.prisma.client.findFirst({
        where: {
          id: invoice.clientId,
          orgId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        }
      });

      if (!client) {
        throw new Error('Client not found');
      }

      // Get project details if available
      let project = null;
      if (invoice.projectId) {
        project = await this.prisma.project.findFirst({
          where: {
            id: invoice.projectId,
            orgId,
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            projectDetails: true,
          }
        });
      }

      // Get organization details
      const organization = await this.prisma.org.findFirst({
        where: { id: orgId },
        select: {
          id: true,
          name: true,
          slug: true,
        }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      // Map to InvoiceData format
      const invoiceData = InvoiceDataMapper.mapFromDatabaseRecord(
        invoice,
        client,
        organization,
        project
      );

      return {
        id: invoice.id,
        data: invoiceData,
        status: invoice.status,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
      };
    } catch (error) {
      console.error('Error getting generated invoice:', error);
      throw error;
    }
  }
}

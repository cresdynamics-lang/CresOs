"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../auth-context";
import { PageHeader } from "../../page-header";
import { SalesWorkspaceNav } from "../sales-workspace-nav";
import { DashboardCardRow, DashboardScrollCard } from "../../../components/dashboard-card-row";

type InvoiceStatus =
  | "draft"
  | "sent"
  | "partial"
  | "paid"
  | "overdue"
  | "cancelled"
  | string;

interface Invoice {
  id: string;
  number?: string;
  invoiceNumber: string;
  clientId?: string;
  projectId?: string;
  status: InvoiceStatus;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  createdAt: string;
  client: { name: string; email: string | null };
  project?: { name: string } | null;
  items: InvoiceItem[];
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone?: string;
}

interface Project {
  id: string;
  name: string;
  clientId: string | null;
  status: string;
  approvalStatus?: string;
  price?: number | null;
  amountReceived?: number | null;
  client: { name: string };
}

export default function SalesInvoicesPage() {
  const router = useRouter();
  const { auth, apiFetch, hydrated } = useAuth();
  const canAccessSalesInvoices = auth.roleKeys.some((r) => ["admin", "sales"].includes(r));
  const isAdmin = auth.roleKeys.includes("admin");
  const [activeTab, setActiveTab] = useState<"dashboard" | "create" | "invoices">("dashboard");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    outstanding: 0,
    paid: 0,
    cancelled: 0
  });

  // Form state for creating invoices
  const [formData, setFormData] = useState({
    clientId: "",
    projectId: "",
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    notes: "",
    subtotal: 0,
    taxAmount: 0,
    totalAmount: 0,
    currency: "KES"
  });
  const [items, setItems] = useState([{
    description: "",
    quantity: 1,
    unitPrice: 0,
    total: 0
  }]);

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccessSalesInvoices) {
      router.replace("/dashboard");
    }
  }, [hydrated, auth.accessToken, canAccessSalesInvoices, router]);

  // Fetch dashboard data
  useEffect(() => {
    if (!auth.accessToken || !canAccessSalesInvoices) return;
    
    if (activeTab === "dashboard") {
      fetchDashboard();
    } else if (activeTab === "invoices") {
      fetchInvoices();
    }
  }, [activeTab, auth.accessToken, canAccessSalesInvoices]);

  // Fetch clients and projects for create form
  useEffect(() => {
    if (!auth.accessToken || !canAccessSalesInvoices || activeTab !== "create") return;
    
    fetchClients();
    fetchProjects();
  }, [activeTab, auth.accessToken, canAccessSalesInvoices]);

  const fetchDashboard = async () => {
    try {
      const response = await apiFetch("/sales/dashboard");
      if (response.ok) {
        const data = await response.json();
        const s = data.data.stats;
        setStats({
          total: s.total ?? 0,
          outstanding: s.outstanding ?? s.pending ?? 0,
          paid: s.paid ?? s.approved ?? 0,
          cancelled: s.cancelled ?? s.rejected ?? 0
        });
        setInvoices(data.data.recentInvoices);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      const response = await apiFetch("/sales/invoices");
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.data.invoices);
      }
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const response = await apiFetch("/sales/clients");
      if (response.ok) {
        const data = await response.json();
        setClients(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch clients:", error);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await apiFetch("/sales/projects");
      if (response.ok) {
        const data = await response.json();
        setProjects(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    }
  };

  const addItem = () => {
    setItems([...items, {
      description: "",
      quantity: 1,
      unitPrice: 0,
      total: 0
    }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Calculate total for the item
    if (field === "quantity" || field === "unitPrice") {
      updatedItems[index].total = updatedItems[index].quantity * updatedItems[index].unitPrice;
    }
    
    setItems(updatedItems);
    
    // Update totals
    const subtotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = subtotal * 0.1; // 10% tax
    const totalAmount = subtotal + taxAmount;
    
    setFormData({
      ...formData,
      subtotal,
      taxAmount,
      totalAmount
    });
  };

  const createInvoice = async () => {
    try {
      const response = await apiFetch("/sales/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId: formData.clientId,
          projectId: formData.projectId || undefined,
          issueDate: formData.issueDate,
          dueDate: formData.dueDate || undefined,
          currency: formData.currency,
          notes: formData.notes || undefined,
          items: items.filter(item => item.description && item.quantity > 0 && item.unitPrice > 0)
        })
      });

      if (response.ok) {
        await response.json();
        alert(
          "Invoice created and saved. Finance records payments against this invoice; when a payment is confirmed, the linked project’s received amount updates automatically."
        );
        
        // Reset form
        setFormData({
          clientId: "",
          projectId: "",
          issueDate: new Date().toISOString().slice(0, 10),
          dueDate: "",
          notes: "",
          subtotal: 0,
          taxAmount: 0,
          totalAmount: 0,
          currency: "KES"
        });
        setItems([{
          description: "",
          quantity: 1,
          unitPrice: 0,
          total: 0
        }]);
        
        setActiveTab("dashboard");
        fetchDashboard();
      }
    } catch (error) {
      console.error("Failed to create invoice:", error);
      alert("Failed to create invoice. Please try again.");
    }
  };

  const formatCurrency = (amount: number, currency: string = "KES") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "text-yellow-400 bg-yellow-900/20";
      case "sent":
      case "partial":
      case "overdue":
        return "text-sky-400 bg-sky-900/20";
      case "paid":
        return "text-green-400 bg-green-900/20";
      case "cancelled":
        return "text-red-400 bg-red-900/20";
      default:
        return "text-slate-400 bg-slate-900/20";
    }
  };

  const projectsForClient = formData.clientId
    ? projects.filter((p) => !p.clientId || p.clientId === formData.clientId)
    : projects;

  const projectNeedsSelection = !isAdmin;
  const canSubmitInvoice =
    !!formData.clientId &&
    (!projectNeedsSelection || !!formData.projectId) &&
    items.some((item) => item.description && item.quantity > 0 && item.unitPrice > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10">
      <PageHeader
        title="Sales invoices"
        description="Create invoices tied to projects—lists load from the database. Finance records payments on each invoice; confirming payment increases the project’s amount received when the invoice has a project."
      />
      <div className="mb-6">
        <SalesWorkspaceNav />
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/30">
          <p className="text-slate-400">Loading…</p>
        </div>
      ) : (
        <>
      {/* Tabs */}
      <div className="flex border-b border-slate-800 mb-6">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === "dashboard"
              ? "border-b-2 border-brand text-brand"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab("create")}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === "create"
              ? "border-b-2 border-brand text-brand"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Create Invoice
        </button>
        <button
          onClick={() => setActiveTab("invoices")}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === "invoices"
              ? "border-b-2 border-brand text-brand"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          My Invoices
        </button>
      </div>

      {/* Dashboard Tab */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <DashboardCardRow lgCols={4} layout="scroll">
            <DashboardScrollCard>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
                <div className="text-2xl font-bold text-slate-200">{stats.total}</div>
                <div className="text-sm text-slate-400">Total Invoices</div>
              </div>
            </DashboardScrollCard>
            <DashboardScrollCard>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
                <div className="text-2xl font-bold text-yellow-400">{stats.outstanding}</div>
                <div className="text-sm text-slate-400">Outstanding (not fully paid)</div>
              </div>
            </DashboardScrollCard>
            <DashboardScrollCard>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
                <div className="text-2xl font-bold text-green-400">{stats.paid}</div>
                <div className="text-sm text-slate-400">Paid</div>
              </div>
            </DashboardScrollCard>
            <DashboardScrollCard>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
                <div className="text-2xl font-bold text-red-400">{stats.cancelled}</div>
                <div className="text-sm text-slate-400">Cancelled</div>
              </div>
            </DashboardScrollCard>
          </DashboardCardRow>

          {/* Recent Invoices */}
          <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
            <h2 className="text-xl font-semibold text-slate-200 mb-4">Recent Invoices</h2>
            {invoices.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <div className="mb-2">📄</div>
                <div>No invoices yet</div>
              </div>
            ) : (
              <div className="space-y-4">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="font-medium text-slate-200">
                          {invoice.invoiceNumber || invoice.number}
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(invoice.status)}`}>
                          {invoice.status}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400">{invoice.client.name}</div>
                      <div className="text-xs text-slate-500">{formatDate(invoice.createdAt)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-slate-200">{formatCurrency(invoice.totalAmount, invoice.currency)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Invoice Tab */}
      {activeTab === "create" && (
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-6">Create New Invoice</h2>
          
          <div className="space-y-6">
            {/* Client Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Client *
                </label>
                <select
                  value={formData.clientId}
                  onChange={(e) =>
                    setFormData({ ...formData, clientId: e.target.value, projectId: "" })
                  }
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand"
                  required
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Project {projectNeedsSelection ? "*" : "(optional)"}
                </label>
                <select
                  value={formData.projectId}
                  onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand"
                  required={projectNeedsSelection}
                >
                  <option value="">
                    {formData.clientId ? "Select a project" : "Select a client first"}
                  </option>
                  {projectsForClient.map((project) => {
                    const received = project.amountReceived ?? 0;
                    const price = project.price ?? null;
                    const remaining =
                      price != null ? Math.max(0, price - received) : null;
                    const suffix =
                      remaining != null
                        ? ` — ${formatCurrency(remaining, formData.currency)} remaining`
                        : "";
                    return (
                      <option key={project.id} value={project.id}>
                        {project.name} ({project.client.name}){suffix}
                      </option>
                    );
                  })}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Required for sales users so payments can update the correct project balance.
                </p>
              </div>
            </div>

            {/* Due Date and Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Issue date *
                </label>
                <input
                  type="date"
                  value={formData.issueDate}
                  onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Due Date
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Notes
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Payment terms, etc."
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:border-brand"
                />
              </div>
            </div>

            {/* Invoice Items */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-slate-200">Invoice Items</h3>
                <button
                  onClick={addItem}
                  className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/80 transition-colors"
                >
                  Add Item
                </button>
              </div>
              
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-slate-800/50 rounded-lg">
                    <div className="md:col-span-2">
                      <input
                        type="text"
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateItem(index, "description", e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-200 placeholder-slate-400 focus:outline-none focus:border-brand"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                        min="1"
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-200 placeholder-slate-400 focus:outline-none focus:border-brand"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        placeholder="Unit Price"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-200 placeholder-slate-400 focus:outline-none focus:border-brand"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-slate-200">
                        {formatCurrency(item.total)}
                      </div>
                      {items.length > 1 && (
                        <button
                          onClick={() => removeItem(index)}
                          className="p-1 text-red-400 hover:text-red-300"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="border-t border-slate-700 pt-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Subtotal:</span>
                  <span className="text-slate-200">{formatCurrency(formData.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Tax (10%):</span>
                  <span className="text-slate-200">{formatCurrency(formData.taxAmount)}</span>
                </div>
                <div className="flex justify-between text-lg font-medium">
                  <span className="text-slate-200">Total:</span>
                  <span className="text-brand">{formatCurrency(formData.totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                onClick={createInvoice}
                disabled={!canSubmitInvoice}
                className="px-6 py-3 bg-brand text-white rounded-lg hover:bg-brand/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My Invoices Tab */}
      {activeTab === "invoices" && (
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-4">My Invoices</h2>
          
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <div className="mb-2">📄</div>
              <div>No invoices found</div>
            </div>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="font-medium text-slate-200">
                          {invoice.invoiceNumber || invoice.number}
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(invoice.status)}`}>
                          {invoice.status}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400 mb-1">
                        Client: {invoice.client.name}
                        {invoice.project && ` • Project: ${invoice.project.name}`}
                      </div>
                      <div className="text-xs text-slate-500">
                        {invoice.issueDate && `Issued: ${formatDate(invoice.issueDate)} • `}
                        Created: {formatDate(invoice.createdAt)}
                        {invoice.dueDate && ` • Due: ${formatDate(invoice.dueDate)}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-slate-200 mb-1">{formatCurrency(invoice.totalAmount, invoice.currency)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
}

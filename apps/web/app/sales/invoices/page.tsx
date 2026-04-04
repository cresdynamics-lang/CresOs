"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../auth-context";

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  projectId?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  dueDate?: string;
  notes?: string;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: { displayName: string };
  rejectionReason?: string;
  client: { name: string; email: string };
  project?: { name: string };
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
  email: string;
  phone?: string;
  billingAddress?: string;
}

interface Project {
  id: string;
  name: string;
  clientId: string;
  status: string;
  client: { name: string };
}

export default function SalesInvoicesPage() {
  const router = useRouter();
  const { auth, apiFetch, hydrated } = useAuth();
  const canAccessSalesInvoices = auth.roleKeys.some((r) => ["admin", "sales"].includes(r));
  const [activeTab, setActiveTab] = useState<"dashboard" | "create" | "invoices">("dashboard");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });

  // Form state for creating invoices
  const [formData, setFormData] = useState({
    clientId: "",
    projectId: "",
    dueDate: "",
    notes: "",
    subtotal: 0,
    taxAmount: 0,
    totalAmount: 0,
    currency: "USD"
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
        setStats(data.data.stats);
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
          ...formData,
          items: items.filter(item => item.description && item.quantity > 0 && item.unitPrice > 0)
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert("Invoice created successfully and sent for finance approval!");
        
        // Reset form
        setFormData({
          clientId: "",
          projectId: "",
          dueDate: "",
          notes: "",
          subtotal: 0,
          taxAmount: 0,
          totalAmount: 0,
          currency: "USD"
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

  const formatCurrency = (amount: number, currency: string = "USD") => {
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
      case "PENDING": return "text-yellow-400 bg-yellow-900/20";
      case "APPROVED": return "text-green-400 bg-green-900/20";
      case "REJECTED": return "text-red-400 bg-red-900/20";
      default: return "text-slate-400 bg-slate-900/20";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading sales dashboard...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-200 mb-2">Sales Invoices</h1>
        <p className="text-slate-400">Create and manage invoices. All invoices require finance approval before generation.</p>
      </div>

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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
              <div className="text-2xl font-bold text-slate-200">{stats.total}</div>
              <div className="text-sm text-slate-400">Total Invoices</div>
            </div>
            <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
              <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
              <div className="text-sm text-slate-400">Pending Approval</div>
            </div>
            <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
              <div className="text-2xl font-bold text-green-400">{stats.approved}</div>
              <div className="text-sm text-slate-400">Approved</div>
            </div>
            <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
              <div className="text-2xl font-bold text-red-400">{stats.rejected}</div>
              <div className="text-sm text-slate-400">Rejected</div>
            </div>
          </div>

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
                        <div className="font-medium text-slate-200">{invoice.invoiceNumber}</div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(invoice.status)}`}>
                          {invoice.status}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400">{invoice.client.name}</div>
                      <div className="text-xs text-slate-500">{formatDate(invoice.createdAt)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-slate-200">{formatCurrency(invoice.totalAmount, invoice.currency)}</div>
                      {invoice.approvedBy && (
                        <div className="text-xs text-slate-500">Approved by {invoice.approvedBy.displayName}</div>
                      )}
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
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
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
                  Project (Optional)
                </label>
                <select
                  value={formData.projectId}
                  onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand"
                >
                  <option value="">Select a project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Due Date and Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                disabled={!formData.clientId || items.filter(item => item.description && item.quantity > 0 && item.unitPrice > 0).length === 0}
                className="px-6 py-3 bg-brand text-white rounded-lg hover:bg-brand/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create Invoice (Requires Finance Approval)
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
                        <div className="font-medium text-slate-200">{invoice.invoiceNumber}</div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(invoice.status)}`}>
                          {invoice.status}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400 mb-1">
                        Client: {invoice.client.name}
                        {invoice.project && ` • Project: ${invoice.project.name}`}
                      </div>
                      <div className="text-xs text-slate-500">
                        Created: {formatDate(invoice.createdAt)}
                        {invoice.dueDate && ` • Due: ${formatDate(invoice.dueDate)}`}
                      </div>
                      {invoice.rejectionReason && (
                        <div className="mt-2 p-2 bg-red-900/20 border border-red-800 rounded text-sm text-red-400">
                          <strong>Rejection Reason:</strong> {invoice.rejectionReason}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-slate-200 mb-1">{formatCurrency(invoice.totalAmount, invoice.currency)}</div>
                      {invoice.approvedBy && (
                        <div className="text-xs text-slate-500">
                          Approved by {invoice.approvedBy.displayName}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

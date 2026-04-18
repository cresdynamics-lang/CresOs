"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../auth-context";
import { DashboardCardRow, DashboardScrollCard } from "../../../components/dashboard-card-row";

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
  approvalNotes?: string;
  client: { name: string; email: string };
  project?: { name: string };
  items: InvoiceItem[];
  createdBy: { displayName: string };
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export default function FinanceInvoicesPage() {
  const router = useRouter();
  const { auth, apiFetch, hydrated } = useAuth();
  const canAccessFinanceInvoices = auth.roleKeys.some((r) => ["admin", "finance"].includes(r));
  const isAdmin = auth.roleKeys.includes("admin");
  const [activeTab, setActiveTab] = useState<"dashboard" | "pending" | "all">("dashboard");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    totalRevenue: 0
  });
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approvalNotes, setApprovalNotes] = useState("");

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccessFinanceInvoices) {
      router.replace("/dashboard");
      return;
    }
    // Invoice approvals are now unified under /approvals
    router.replace("/approvals");
  }, [hydrated, auth.accessToken, canAccessFinanceInvoices, router]);

  if (hydrated && auth.accessToken && canAccessFinanceInvoices) {
    return (
      <div className="shell text-sm text-slate-400">
        Redirecting to unified approvals…
      </div>
    );
  }

  // Fetch dashboard data
  useEffect(() => {
    if (!auth.accessToken || !canAccessFinanceInvoices) return;
    
    if (activeTab === "dashboard") {
      fetchDashboard();
    } else if (activeTab === "pending") {
      fetchPendingInvoices();
    } else if (activeTab === "all") {
      fetchAllInvoices();
    }
  }, [activeTab, auth.accessToken, canAccessFinanceInvoices]);

  const fetchDashboard = async () => {
    try {
      const response = await apiFetch("/finance/dashboard");
      if (response.ok) {
        const data = await response.json();
        setStats(data.data.stats);
        setInvoices(data.data.pendingInvoices);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingInvoices = async () => {
    try {
      const response = await apiFetch("/finance/invoices/pending");
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.data.invoices);
      }
    } catch (error) {
      console.error("Failed to fetch pending invoices:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllInvoices = async () => {
    try {
      const response = await apiFetch("/finance/invoices");
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.data.invoices);
      }
    } catch (error) {
      console.error("Failed to fetch all invoices:", error);
    } finally {
      setLoading(false);
    }
  };

  const approveInvoice = async (invoiceId: string) => {
    try {
      const response = await apiFetch(`/finance/invoices/${invoiceId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notes: approvalNotes
        })
      });

      if (response.ok) {
        alert("Invoice approved successfully!");
        setSelectedInvoice(null);
        setApprovalNotes("");
        
        // Refresh the current tab
        if (activeTab === "dashboard") {
          fetchDashboard();
        } else if (activeTab === "pending") {
          fetchPendingInvoices();
        } else {
          fetchAllInvoices();
        }
      }
    } catch (error) {
      console.error("Failed to approve invoice:", error);
      alert("Failed to approve invoice. Please try again.");
    }
  };

  const rejectInvoice = async (invoiceId: string) => {
    if (!rejectionReason.trim()) {
      alert("Please provide a rejection reason.");
      return;
    }

    try {
      const response = await apiFetch(`/finance/invoices/${invoiceId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: rejectionReason.trim()
        })
      });

      if (response.ok) {
        alert("Invoice rejected successfully!");
        setSelectedInvoice(null);
        setRejectionReason("");
        
        // Refresh the current tab
        if (activeTab === "dashboard") {
          fetchDashboard();
        } else if (activeTab === "pending") {
          fetchPendingInvoices();
        } else {
          fetchAllInvoices();
        }
      }
    } catch (error) {
      console.error("Failed to reject invoice:", error);
      alert("Failed to reject invoice. Please try again.");
    }
  };

  const generateInvoice = async (invoiceId: string) => {
    try {
      const response = await apiFetch(`/finance/invoices/${invoiceId}/generate`, {
        method: "POST"
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Invoice ${data.data.invoiceNumber} generated successfully!`);
        
        // Refresh the current tab
        if (activeTab === "dashboard") {
          fetchDashboard();
        } else if (activeTab === "pending") {
          fetchPendingInvoices();
        } else {
          fetchAllInvoices();
        }
      }
    } catch (error) {
      console.error("Failed to generate invoice:", error);
      alert("Failed to generate invoice. Please try again.");
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
        <div className="text-slate-400">Loading finance dashboard...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-200 mb-2">Finance Invoice Approvals</h1>
        <p className="text-slate-400">
          Pending invoices are visible to finance and leadership. Only an organization admin can approve, reject, or generate official invoice documents.
        </p>
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
          onClick={() => setActiveTab("pending")}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === "pending"
              ? "border-b-2 border-brand text-brand"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Pending Approval ({stats.pending})
        </button>
        <button
          onClick={() => setActiveTab("all")}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === "all"
              ? "border-b-2 border-brand text-brand"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          All Invoices
        </button>
      </div>

      {/* Dashboard Tab */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <DashboardCardRow lgCols={4} layout="scroll">
            <DashboardScrollCard>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
                <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
                <div className="text-sm text-slate-400">Pending Approval</div>
              </div>
            </DashboardScrollCard>
            <DashboardScrollCard>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
                <div className="text-2xl font-bold text-green-400">{stats.approved}</div>
                <div className="text-sm text-slate-400">Approved</div>
              </div>
            </DashboardScrollCard>
            <DashboardScrollCard>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
                <div className="text-2xl font-bold text-red-400">{stats.rejected}</div>
                <div className="text-sm text-slate-400">Rejected</div>
              </div>
            </DashboardScrollCard>
            <DashboardScrollCard>
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
                <div className="text-2xl font-bold text-brand">{formatCurrency(stats.totalRevenue)}</div>
                <div className="text-sm text-slate-400">Total Revenue</div>
              </div>
            </DashboardScrollCard>
          </DashboardCardRow>

          {/* Pending Invoices */}
          <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
            <h2 className="text-xl font-semibold text-slate-200 mb-4">Pending Invoices</h2>
            {invoices.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <div className="mb-2">📄</div>
                <div>No pending invoices</div>
              </div>
            ) : (
              <div className="space-y-4">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
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
                        Created by {invoice.createdBy.displayName} • {formatDate(invoice.createdAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-medium text-slate-200">{formatCurrency(invoice.totalAmount, invoice.currency)}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedInvoice(invoice)}
                          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-sm transition-colors"
                        >
                          Review
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pending Invoices Tab */}
      {activeTab === "pending" && (
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-4">Pending Invoices</h2>
          
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <div className="mb-2">📄</div>
              <div>No pending invoices</div>
            </div>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
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
                      Created by {invoice.createdBy.displayName} • {formatDate(invoice.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-medium text-slate-200">{formatCurrency(invoice.totalAmount, invoice.currency)}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedInvoice(invoice)}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-sm transition-colors"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Invoices Tab */}
      {activeTab === "all" && (
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-4">All Invoices</h2>
          
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <div className="mb-2">📄</div>
              <div>No invoices found</div>
            </div>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
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
                      Created by {invoice.createdBy.displayName} • {formatDate(invoice.createdAt)}
                      {invoice.approvedBy && ` • Approved by ${invoice.approvedBy.displayName}`}
                    </div>
                    {invoice.rejectionReason && (
                      <div className="mt-2 text-xs text-red-400">
                        Rejected: {invoice.rejectionReason}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-medium text-slate-200">{formatCurrency(invoice.totalAmount, invoice.currency)}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedInvoice(invoice)}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-sm transition-colors"
                      >
                        Review
                      </button>
                      {invoice.status === "APPROVED" && (
                        <button
                          onClick={() => generateInvoice(invoice.id)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
                        >
                          Generate
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invoice Review Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-200">
                Invoice {selectedInvoice.invoiceNumber}
              </h2>
              <button
                onClick={() => {
                  setSelectedInvoice(null);
                  setRejectionReason("");
                  setApprovalNotes("");
                }}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Invoice Details */}
            <div className="space-y-6">
              {/* Client and Project Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-2">Client</h3>
                  <div className="text-slate-200">{selectedInvoice.client.name}</div>
                  <div className="text-sm text-slate-400">{selectedInvoice.client.email}</div>
                </div>
                {selectedInvoice.project && (
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-2">Project</h3>
                    <div className="text-slate-200">{selectedInvoice.project.name}</div>
                  </div>
                )}
              </div>

              {/* Invoice Items */}
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-2">Invoice Items</h3>
                <div className="space-y-2">
                  {selectedInvoice.items.map((item) => (
                    <div key={item.id} className="flex justify-between p-2 bg-slate-800/50 rounded">
                      <div className="flex-1">
                        <div className="text-slate-200">{item.description}</div>
                        <div className="text-sm text-slate-400">
                          {item.quantity} × {formatCurrency(item.unitPrice)}
                        </div>
                      </div>
                      <div className="text-slate-200 font-medium">
                        {formatCurrency(item.total)}
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
                    <span className="text-slate-200">{formatCurrency(selectedInvoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Tax:</span>
                    <span className="text-slate-200">{formatCurrency(selectedInvoice.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-medium">
                    <span className="text-slate-200">Total:</span>
                    <span className="text-brand">{formatCurrency(selectedInvoice.totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedInvoice.notes && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-2">Notes</h3>
                  <div className="text-slate-200">{selectedInvoice.notes}</div>
                </div>
              )}

              {/* Approval Actions — admin only */}
              {selectedInvoice.status === "PENDING" && isAdmin && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Approval Notes (Optional)
                    </label>
                    <textarea
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      placeholder="Add any notes about this approval..."
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:border-brand resize-none"
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Rejection Reason (if rejecting)
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Reason for rejection..."
                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:border-brand resize-none"
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end gap-4">
                    <button
                      onClick={() => rejectInvoice(selectedInvoice.id)}
                      className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    >
                      Reject Invoice
                    </button>
                    <button
                      onClick={() => approveInvoice(selectedInvoice.id)}
                      className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    >
                      Approve Invoice
                    </button>
                  </div>
                </div>
              )}

              {selectedInvoice.status === "PENDING" && !isAdmin && (
                <p className="text-sm text-slate-400">
                  This invoice is waiting for an organization admin to approve or reject it.
                </p>
              )}

              {/* Approved/Rejected Info */}
              {(selectedInvoice.status === "APPROVED" || selectedInvoice.status === "REJECTED") && (
                <div className="space-y-4">
                  {selectedInvoice.status === "APPROVED" && (
                    <div className="p-4 bg-green-900/20 border border-green-800 rounded">
                      <div className="text-sm text-green-400">
                        <strong>Approved by:</strong> {selectedInvoice.approvedBy?.displayName}
                      </div>
                      <div className="text-sm text-green-400">
                        <strong>Approved on:</strong> {selectedInvoice.approvedAt ? formatDate(selectedInvoice.approvedAt) : 'N/A'}
                      </div>
                      {selectedInvoice.approvalNotes && (
                        <div className="text-sm text-green-400 mt-2">
                          <strong>Notes:</strong> {selectedInvoice.approvalNotes}
                        </div>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => generateInvoice(selectedInvoice.id)}
                          className="mt-4 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        >
                          Generate Invoice PDF
                        </button>
                      )}
                    </div>
                  )}
                  
                  {selectedInvoice.status === "REJECTED" && (
                    <div className="p-4 bg-red-900/20 border border-red-800 rounded">
                      <div className="text-sm text-red-400">
                        <strong>Rejected by:</strong> {selectedInvoice.approvedBy?.displayName}
                      </div>
                      <div className="text-sm text-red-400">
                        <strong>Rejected on:</strong> {selectedInvoice.approvedAt ? formatDate(selectedInvoice.approvedAt) : 'N/A'}
                      </div>
                      <div className="text-sm text-red-400 mt-2">
                        <strong>Reason:</strong> {selectedInvoice.rejectionReason}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

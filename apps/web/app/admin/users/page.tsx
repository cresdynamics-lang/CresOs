"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../auth-context";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  phoneNumbers: string[];
  workEmails: string[];
  profilePicture?: string;
  nextOfKin: {
    name: string;
    phone: string;
    relationship: string;
  }[];
  status: string;
  role: {
    name: string;
    key: string;
    department: {
      name: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export default function AdminUsersPage() {
  const { auth, apiFetch } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await apiFetch("/admin/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const response = await apiFetch(`/user/${userId}/profile`);
      if (response.ok) {
        const data = await response.json();
        setSelectedUser(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === "all" || user.role.key === filterRole;
    return matchesSearch && matchesRole;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "text-green-400 bg-green-900/20";
      case "locked": return "text-yellow-400 bg-yellow-900/20";
      case "suspended": return "text-red-400 bg-red-900/20";
      default: return "text-slate-400 bg-slate-900/20";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-200 mb-2">User Management</h1>
        <p className="text-slate-400">View and manage user profiles and details.</p>
      </div>

      {/* Filters */}
      <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:border-brand"
            />
          </div>
          <div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="director_admin">Director Admin</option>
              <option value="finance">Finance</option>
              <option value="sales">Sales</option>
              <option value="developer">Developer</option>
              <option value="analyst">Analyst</option>
              <option value="client">Client</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
        <h2 className="text-xl font-semibold text-slate-200 mb-4">Users ({filteredUsers.length})</h2>
        
        {filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <div className="mb-2">👥</div>
            <div>No users found</div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-lg font-medium text-slate-200">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-slate-200">{user.name}</div>
                    <div className="text-sm text-slate-400">{user.email}</div>
                    <div className="text-xs text-slate-500">
                      {user.role.name} • {user.role.department.name}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(user.status)}`}>
                    {user.status}
                  </span>
                  <button
                    onClick={() => fetchUserProfile(user.id)}
                    className="px-3 py-1 bg-brand text-white rounded text-sm hover:bg-brand/80 transition-colors"
                  >
                    View Profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User Profile Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-200">
                User Profile: {selectedUser.name}
              </h2>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-2">Basic Information</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-slate-500">Name:</span>
                      <div className="text-slate-200">{selectedUser.name}</div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">Email:</span>
                      <div className="text-slate-200">{selectedUser.email}</div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">Role:</span>
                      <div className="text-slate-200">{selectedUser.role.name}</div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">Department:</span>
                      <div className="text-slate-200">{selectedUser.role.department.name}</div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">Status:</span>
                      <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(selectedUser.status)}`}>
                        {selectedUser.status}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-2">Account Information</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-slate-500">User ID:</span>
                      <div className="text-slate-200 text-sm">{selectedUser.id}</div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">Created:</span>
                      <div className="text-slate-200">{formatDate(selectedUser.createdAt)}</div>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">Last Updated:</span>
                      <div className="text-slate-200">{formatDate(selectedUser.updatedAt)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Details */}
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-2">Contact Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-slate-500">Primary Phone:</span>
                    <div className="text-slate-200">{selectedUser.phone || "Not set"}</div>
                  </div>
                  
                  <div>
                    <span className="text-xs text-slate-500">Additional Phones:</span>
                    <div className="text-slate-200">
                      {selectedUser.phoneNumbers.length > 0 ? (
                        <div className="space-y-1">
                          {selectedUser.phoneNumbers.map((phone, index) => (
                            <div key={index} className="text-sm">{phone}</div>
                          ))}
                        </div>
                      ) : (
                        "None"
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-xs text-slate-500">Work Emails:</span>
                    <div className="text-slate-200">
                      {selectedUser.workEmails.length > 0 ? (
                        <div className="space-y-1">
                          {selectedUser.workEmails.map((email, index) => (
                            <div key={index} className="text-sm">{email}</div>
                          ))}
                        </div>
                      ) : (
                        "None"
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Next of Kin */}
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-2">Next of Kin Information</h3>
                <div className="space-y-4">
                  {selectedUser.nextOfKin.map((kin, index) => (
                    <div key={index} className="p-3 bg-slate-800/50 rounded-lg">
                      <h4 className="text-sm font-medium text-slate-200 mb-2">Next of Kin {index + 1}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <span className="text-xs text-slate-500">Name:</span>
                          <div className="text-slate-200">{kin.name || "Not set"}</div>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500">Phone:</span>
                          <div className="text-slate-200">{kin.phone || "Not set"}</div>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500">Relationship:</span>
                          <div className="text-slate-200">{kin.relationship || "Not set"}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Profile Picture */}
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-2">Profile Picture</h3>
                <div className="flex items-center gap-4">
                  {selectedUser.profilePicture ? (
                    <img
                      src={selectedUser.profilePicture}
                      alt="Profile"
                      className="w-20 h-20 rounded-full"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center text-2xl font-medium text-slate-200">
                      {selectedUser.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="text-slate-200">Profile picture</div>
                    <div className="text-sm text-slate-400">
                      {selectedUser.profilePicture ? "Uploaded" : "Default avatar"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

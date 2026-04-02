"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../auth-context";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phoneNumbers: string[];
  workEmails: string[];
  profilePicture?: string;
  nextOfKin: {
    name: string;
    phone: string;
    relationship: string;
  }[];
  role: string;
  department: string;
  createdAt: string;
  updatedAt: string;
}

export default function ProfileSettingsPage() {
  const { auth, apiFetch } = useAuth();
  const [activeTab, setActiveTab] = useState<"profile" | "contact" | "kin" | "picture">("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    id: auth.userId || "",
    name: auth.userName || "",
    email: auth.userEmail || "",
    phoneNumbers: [""],
    workEmails: [""],
    nextOfKin: [
      { name: "", phone: "", relationship: "" },
      { name: "", phone: "", relationship: "" }
    ],
    role: "",
    department: "",
    createdAt: "",
    updatedAt: ""
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await apiFetch("/user/profile");
      if (response.ok) {
        const data = await response.json();
        setProfile({
          ...profile,
          ...data.data,
          phoneNumbers: data.data.phoneNumbers?.length > 0 ? data.data.phoneNumbers : [""],
          workEmails: data.data.workEmails?.length > 0 ? data.data.workEmails : [""],
          nextOfKin: data.data.nextOfKin?.length > 0 ? data.data.nextOfKin : [
            { name: "", phone: "", relationship: "" },
            { name: "", phone: "", relationship: "" }
          ]
        });
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async () => {
    setSaving(true);
    try {
      const response = await apiFetch("/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: profile.name,
          phoneNumbers: profile.phoneNumbers.filter(p => p.trim()),
          workEmails: profile.workEmails.filter(e => e.trim()),
          nextOfKin: profile.nextOfKin.filter(k => k.name.trim() && k.phone.trim())
        })
      });

      if (response.ok) {
        alert("Profile updated successfully!");
        fetchProfile();
      }
    } catch (error) {
      console.error("Failed to update profile:", error);
      alert("Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const addPhoneNumber = () => {
    setProfile({
      ...profile,
      phoneNumbers: [...profile.phoneNumbers, ""]
    });
  };

  const removePhoneNumber = (index: number) => {
    if (profile.phoneNumbers.length > 1) {
      setProfile({
        ...profile,
        phoneNumbers: profile.phoneNumbers.filter((_, i) => i !== index)
      });
    }
  };

  const updatePhoneNumber = (index: number, value: string) => {
    const updated = [...profile.phoneNumbers];
    updated[index] = value;
    setProfile({ ...profile, phoneNumbers: updated });
  };

  const addWorkEmail = () => {
    setProfile({
      ...profile,
      workEmails: [...profile.workEmails, ""]
    });
  };

  const removeWorkEmail = (index: number) => {
    if (profile.workEmails.length > 1) {
      setProfile({
        ...profile,
        workEmails: profile.workEmails.filter((_, i) => i !== index)
      });
    }
  };

  const updateWorkEmail = (index: number, value: string) => {
    const updated = [...profile.workEmails];
    updated[index] = value;
    setProfile({ ...profile, workEmails: updated });
  };

  const updateNextOfKin = (index: number, field: keyof typeof profile.nextOfKin[0], value: string) => {
    const updated = [...profile.nextOfKin];
    updated[index] = { ...updated[index], [field]: value };
    setProfile({ ...profile, nextOfKin: updated });
  };

  const handleProfilePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // TODO: Implement file upload
      alert("Profile picture upload will be implemented soon");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading profile settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-200 mb-2">Profile Settings</h1>
        <p className="text-slate-400">Manage your personal information and contact details.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 mb-6">
        <button
          onClick={() => setActiveTab("profile")}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === "profile"
              ? "border-b-2 border-brand text-brand"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Basic Info
        </button>
        <button
          onClick={() => setActiveTab("contact")}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === "contact"
              ? "border-b-2 border-brand text-brand"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Contact Details
        </button>
        <button
          onClick={() => setActiveTab("kin")}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === "kin"
              ? "border-b-2 border-brand text-brand"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Next of Kin
        </button>
        <button
          onClick={() => setActiveTab("picture")}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === "picture"
              ? "border-b-2 border-brand text-brand"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Profile Picture
        </button>
      </div>

      {/* Basic Info Tab */}
      {activeTab === "profile" && (
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-6">Basic Information</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 cursor-not-allowed"
                title="Primary email cannot be changed here"
              />
              <p className="text-xs text-slate-500 mt-1">Primary email address - contact admin to change</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Role
              </label>
              <input
                type="text"
                value={profile.role}
                disabled
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 cursor-not-allowed"
                title="Role assigned by admin"
              />
              <p className="text-xs text-slate-500 mt-1">Role assigned by administrator</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Department
              </label>
              <input
                type="text"
                value={profile.department}
                disabled
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 cursor-not-allowed"
                title="Department assigned by admin"
              />
              <p className="text-xs text-slate-500 mt-1">Department assigned by administrator</p>
            </div>
          </div>

          <div className="flex justify-end mt-8">
            <button
              onClick={updateProfile}
              disabled={saving}
              className="px-6 py-3 bg-brand text-white rounded-lg hover:bg-brand/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Contact Details Tab */}
      {activeTab === "contact" && (
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-6">Contact Details</h2>
          
          <div className="space-y-6">
            {/* Phone Numbers */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-slate-200">Phone Numbers</h3>
                <button
                  onClick={addPhoneNumber}
                  className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/80 transition-colors"
                >
                  Add Phone
                </button>
              </div>
              
              <div className="space-y-3">
                {profile.phoneNumbers.map((phone, index) => (
                  <div key={index} className="flex gap-3">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => updatePhoneNumber(index, e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:border-brand"
                    />
                    {profile.phoneNumbers.length > 1 && (
                      <button
                        onClick={() => removePhoneNumber(index)}
                        className="p-2 text-red-400 hover:text-red-300"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Work Emails */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-slate-200">Work Emails</h3>
                <button
                  onClick={addWorkEmail}
                  className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/80 transition-colors"
                >
                  Add Email
                </button>
              </div>
              
              <div className="space-y-3">
                {profile.workEmails.map((email, index) => (
                  <div key={index} className="flex gap-3">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => updateWorkEmail(index, e.target.value)}
                      placeholder="work@company.com"
                      className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:border-brand"
                    />
                    {profile.workEmails.length > 1 && (
                      <button
                        onClick={() => removeWorkEmail(index)}
                        className="p-2 text-red-400 hover:text-red-300"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-8">
            <button
              onClick={updateProfile}
              disabled={saving}
              className="px-6 py-3 bg-brand text-white rounded-lg hover:bg-brand/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Next of Kin Tab */}
      {activeTab === "kin" && (
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-6">Next of Kin Information</h2>
          
          <div className="space-y-6">
            {profile.nextOfKin.map((kin, index) => (
              <div key={index} className="p-4 bg-slate-800/50 rounded-lg">
                <h3 className="text-lg font-medium text-slate-200 mb-4">
                  Next of Kin {index + 1}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={kin.name}
                      onChange={(e) => updateNextOfKin(index, "name", e.target.value)}
                      placeholder="John Doe"
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:border-brand"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={kin.phone}
                      onChange={(e) => updateNextOfKin(index, "phone", e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:border-brand"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Relationship
                    </label>
                    <input
                      type="text"
                      value={kin.relationship}
                      onChange={(e) => updateNextOfKin(index, "relationship", e.target.value)}
                      placeholder="Spouse, Parent, Sibling, etc."
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-8">
            <button
              onClick={updateProfile}
              disabled={saving}
              className="px-6 py-3 bg-brand text-white rounded-lg hover:bg-brand/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Profile Picture Tab */}
      {activeTab === "picture" && (
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-6">Profile Picture</h2>
          
          <div className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="w-32 h-32 rounded-full bg-slate-700 flex items-center justify-center text-3xl font-medium text-slate-200">
                {profile.name.charAt(0).toUpperCase()}
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-slate-200 mb-2">Current Profile Picture</h3>
                <p className="text-sm text-slate-400 mb-4">
                  Your profile picture will be visible to all users in the community and other sections.
                </p>
                
                <div className="flex gap-3">
                  <label className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/80 transition-colors cursor-pointer">
                    Upload New Picture
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureUpload}
                      className="hidden"
                    />
                  </label>
                  
                  <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors">
                    Remove Picture
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-800/50 rounded-lg">
              <h4 className="text-sm font-medium text-slate-300 mb-2">Profile Picture Guidelines:</h4>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>• Use a clear, recent photo of yourself</li>
                <li>• Recommended size: 200x200 pixels</li>
                <li>• File formats: JPG, PNG, GIF</li>
                <li>• Maximum file size: 5MB</li>
                <li>• Visible to all users in the system</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

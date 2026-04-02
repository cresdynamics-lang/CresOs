"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../auth-context";

export default function NotificationsPage() {
  const { auth, apiFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState({
    email: {
      projects: true,
      tasks: true,
      messages: true,
      mentions: true,
      approvals: true,
      reports: false,
      system: true
    },
    push: {
      projects: true,
      tasks: true,
      messages: true,
      mentions: true,
      approvals: true,
      reports: false,
      system: true
    },
    inApp: {
      projects: true,
      tasks: true,
      messages: true,
      mentions: true,
      approvals: true,
      reports: true,
      system: true
    },
    schedule: {
      meetingReminders: true,
      taskDeadlines: true,
      projectMilestones: true
    },
    frequency: {
      immediate: true,
      hourly: false,
      daily: false,
      weekly: false
    }
  });

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await apiFetch("/user/notifications");
      if (response.ok) {
        const data = await response.json();
        setNotifications({ ...notifications, ...data.data });
      }
    } catch (error) {
      console.error("Failed to fetch notification settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateNotifications = async () => {
    setSaving(true);
    try {
      const response = await apiFetch("/user/notifications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(notifications)
      });

      if (response.ok) {
        alert("Notification settings updated successfully!");
      }
    } catch (error) {
      console.error("Failed to update notification settings:", error);
      alert("Failed to update notification settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const updateNotificationSetting = (category: string, setting: string, value: boolean) => {
    setNotifications({
      ...notifications,
      [category]: {
        ...notifications[category as keyof typeof notifications],
        [setting]: value
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading notification settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-200 mb-2">Notifications</h1>
        <p className="text-slate-400">Manage how and when you receive notifications.</p>
      </div>

      <div className="space-y-6">
        {/* Email Notifications */}
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-6">Email Notifications</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Projects</div>
                <div className="text-sm text-slate-400">Project updates, assignments, and changes</div>
              </div>
              <button
                onClick={() => updateNotificationSetting("email", "projects", !notifications.email.projects)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  notifications.email.projects ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  notifications.email.projects ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Tasks</div>
                <div className="text-sm text-slate-400">Task assignments, updates, and deadlines</div>
              </div>
              <button
                onClick={() => updateNotificationSetting("email", "tasks", !notifications.email.tasks)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  notifications.email.tasks ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  notifications.email.tasks ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Messages</div>
                <div className="text-sm text-slate-400">New messages and chat notifications</div>
              </div>
              <button
                onClick={() => updateNotificationSetting("email", "messages", !notifications.email.messages)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  notifications.email.messages ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  notifications.email.messages ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Mentions</div>
                <div className="text-sm text-slate-400">When someone mentions you</div>
              </div>
              <button
                onClick={() => updateNotificationSetting("email", "mentions", !notifications.email.mentions)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  notifications.email.mentions ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  notifications.email.mentions ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Approvals</div>
                <div className="text-sm text-slate-400">Approval requests and status changes</div>
              </div>
              <button
                onClick={() => updateNotificationSetting("email", "approvals", !notifications.email.approvals)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  notifications.email.approvals ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  notifications.email.approvals ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Reports</div>
                <div className="text-sm text-slate-400">Weekly and monthly reports</div>
              </div>
              <button
                onClick={() => updateNotificationSetting("email", "reports", !notifications.email.reports)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  notifications.email.reports ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  notifications.email.reports ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">System</div>
                <div className="text-sm text-slate-400">System updates and maintenance</div>
              </div>
              <button
                onClick={() => updateNotificationSetting("email", "system", !notifications.email.system)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  notifications.email.system ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  notifications.email.system ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Push Notifications */}
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-6">Push Notifications</h2>
          
          <div className="space-y-4">
            {Object.entries(notifications.push).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-200 capitalize">
                    {key === "projects" ? "Projects" :
                     key === "tasks" ? "Tasks" :
                     key === "messages" ? "Messages" :
                     key === "mentions" ? "Mentions" :
                     key === "approvals" ? "Approvals" :
                     key === "reports" ? "Reports" : "System"}
                  </div>
                  <div className="text-sm text-slate-400">
                    {key === "projects" ? "Project updates, assignments, and changes" :
                     key === "tasks" ? "Task assignments, updates, and deadlines" :
                     key === "messages" ? "New messages and chat notifications" :
                     key === "mentions" ? "When someone mentions you" :
                     key === "approvals" ? "Approval requests and status changes" :
                     key === "reports" ? "Weekly and monthly reports" : "System updates and maintenance"}
                  </div>
                </div>
                <button
                  onClick={() => updateNotificationSetting("push", key, !value)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    value ? 'bg-brand' : 'bg-slate-600'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    value ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* In-App Notifications */}
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-6">In-App Notifications</h2>
          
          <div className="space-y-4">
            {Object.entries(notifications.inApp).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-200 capitalize">
                    {key === "projects" ? "Projects" :
                     key === "tasks" ? "Tasks" :
                     key === "messages" ? "Messages" :
                     key === "mentions" ? "Mentions" :
                     key === "approvals" ? "Approvals" :
                     key === "reports" ? "Reports" : "System"}
                  </div>
                  <div className="text-sm text-slate-400">
                    {key === "projects" ? "Project updates, assignments, and changes" :
                     key === "tasks" ? "Task assignments, updates, and deadlines" :
                     key === "messages" ? "New messages and chat notifications" :
                     key === "mentions" ? "When someone mentions you" :
                     key === "approvals" ? "Approval requests and status changes" :
                     key === "reports" ? "Weekly and monthly reports" : "System updates and maintenance"}
                  </div>
                </div>
                <button
                  onClick={() => updateNotificationSetting("inApp", key, !value)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    value ? 'bg-brand' : 'bg-slate-600'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    value ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Schedule Notifications */}
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-6">Schedule Notifications</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Meeting Reminders</div>
                <div className="text-sm text-slate-400">Reminders before scheduled meetings</div>
              </div>
              <button
                onClick={() => updateNotificationSetting("schedule", "meetingReminders", !notifications.schedule.meetingReminders)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  notifications.schedule.meetingReminders ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  notifications.schedule.meetingReminders ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Task Deadlines</div>
                <div className="text-sm text-slate-400">Notifications for upcoming task deadlines</div>
              </div>
              <button
                onClick={() => updateNotificationSetting("schedule", "taskDeadlines", !notifications.schedule.taskDeadlines)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  notifications.schedule.taskDeadlines ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  notifications.schedule.taskDeadlines ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Project Milestones</div>
                <div className="text-sm text-slate-400">Notifications for project milestones</div>
              </div>
              <button
                onClick={() => updateNotificationSetting("schedule", "projectMilestones", !notifications.schedule.projectMilestones)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  notifications.schedule.projectMilestones ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  notifications.schedule.projectMilestones ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Frequency */}
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-6">Notification Frequency</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Immediate</div>
                <div className="text-sm text-slate-400">Receive notifications as they happen</div>
              </div>
              <button
                onClick={() => setNotifications({
                  ...notifications,
                  frequency: { ...notifications.frequency, immediate: !notifications.frequency.immediate }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  notifications.frequency.immediate ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  notifications.frequency.immediate ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Hourly Digest</div>
                <div className="text-sm text-slate-400">Receive hourly summary of notifications</div>
              </div>
              <button
                onClick={() => setNotifications({
                  ...notifications,
                  frequency: { ...notifications.frequency, hourly: !notifications.frequency.hourly }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  notifications.frequency.hourly ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  notifications.frequency.hourly ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Daily Digest</div>
                <div className="text-sm text-slate-400">Receive daily summary of notifications</div>
              </div>
              <button
                onClick={() => setNotifications({
                  ...notifications,
                  frequency: { ...notifications.frequency, daily: !notifications.frequency.daily }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  notifications.frequency.daily ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  notifications.frequency.daily ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-200">Weekly Digest</div>
                <div className="text-sm text-slate-400">Receive weekly summary of notifications</div>
              </div>
              <button
                onClick={() => setNotifications({
                  ...notifications,
                  frequency: { ...notifications.frequency, weekly: !notifications.frequency.weekly }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  notifications.frequency.weekly ? 'bg-brand' : 'bg-slate-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  notifications.frequency.weekly ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={updateNotifications}
            disabled={saving}
            className="px-6 py-3 bg-brand text-white rounded-lg hover:bg-brand/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save Notification Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

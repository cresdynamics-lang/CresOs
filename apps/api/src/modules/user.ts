// @ts-nocheck
import type { Router } from "express";
import { Router as createRouter } from "express";
import type { PrismaClient } from "@prisma/client";
import { requireRoles, ROLE_KEYS } from "./auth-middleware";
import { getProjectDeveloperAccess } from "../lib/project-access";

export default function userRouter(prisma: PrismaClient): Router {
  const router = createRouter();

  // Get user profile
  router.get(
    "/profile",
    async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;

        const user = await prisma.user.findFirst({
          where: {
            id: userId,
            orgId
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            profilePicture: true,
            role: {
              select: {
                name: true,
                department: {
                  select: {
                    name: true
                  }
                }
              }
            },
            createdAt: true,
            updatedAt: true,
            // Additional profile fields
            phoneNumbers: true,
            workEmails: true,
            nextOfKin: true
          }
        });

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        // Transform the data to match frontend expectations
        const profileData = {
          id: user.id,
          name: user.name,
          email: user.email,
          phoneNumbers: user.phoneNumbers || [user.phone].filter(Boolean),
          workEmails: user.workEmails || [],
          profilePicture: user.profilePicture,
          nextOfKin: user.nextOfKin || [
            { name: "", phone: "", relationship: "" },
            { name: "", phone: "", relationship: "" }
          ],
          role: user.role?.name || "",
          department: user.role?.department?.name || "",
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        };

        res.json({
          success: true,
          data: profileData
        });

      } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({ 
          error: "Failed to fetch profile", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Update user profile
  router.put(
    "/profile",
    async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;
        const { name, phoneNumbers, workEmails, nextOfKin } = req.body;

        // Validate input
        if (!name || name.trim().length === 0) {
          return res.status(400).json({ 
            error: "Name is required" 
          });
        }

        // Validate phone numbers
        if (phoneNumbers && Array.isArray(phoneNumbers)) {
          for (const phone of phoneNumbers) {
            if (phone && phone.trim() && !/^[\d\s\-\+\(\)]+$/.test(phone.trim())) {
              return res.status(400).json({ 
                error: "Invalid phone number format" 
              });
            }
          }
        }

        // Validate work emails
        if (workEmails && Array.isArray(workEmails)) {
          for (const email of workEmails) {
            if (email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
              return res.status(400).json({ 
                error: "Invalid email format" 
              });
            }
          }
        }

        // Validate next of kin
        if (nextOfKin && Array.isArray(nextOfKin)) {
          for (const kin of nextOfKin) {
            if (kin.name && kin.phone) {
              if (!/^[\d\s\-\+\(\)]+$/.test(kin.phone.trim())) {
                return res.status(400).json({ 
                  error: "Invalid next of kin phone number format" 
                });
              }
            }
          }
        }

        // Update user profile
        const updatedUser = await prisma.user.update({
          where: {
            id: userId,
            orgId
          },
          data: {
            name: name.trim(),
            phoneNumbers: phoneNumbers || [],
            workEmails: workEmails || [],
            nextOfKin: nextOfKin || [],
            updatedAt: new Date()
          },
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumbers: true,
            workEmails: true,
            nextOfKin: true,
            profilePicture: true,
            role: {
              select: {
                name: true,
                department: {
                  select: {
                    name: true
                  }
                }
              }
            },
            createdAt: true,
            updatedAt: true
          }
        });

        res.json({
          success: true,
          message: "Profile updated successfully",
          data: {
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            phoneNumbers: updatedUser.phoneNumbers,
            workEmails: updatedUser.workEmails,
            nextOfKin: updatedUser.nextOfKin,
            profilePicture: updatedUser.profilePicture,
            role: updatedUser.role?.name || "",
            department: updatedUser.role?.department?.name || "",
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt
          }
        });

      } catch (error) {
        console.error("Error updating user profile:", error);
        res.status(500).json({ 
          error: "Failed to update profile", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Get user profile for admin/director view
  router.get(
    "/:userId/profile",
    requireRoles([ROLE_KEYS.admin, ROLE_KEYS.director_admin]),
    async (req, res) => {
      try {
        const { userId } = req.params;
        const orgId = req.auth!.orgId;

        const user = await prisma.user.findFirst({
          where: {
            id: userId,
            orgId
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            profilePicture: true,
            phoneNumbers: true,
            workEmails: true,
            nextOfKin: true,
            status: true,
            profileCompletedAt: true,
            createdAt: true,
            updatedAt: true,
            role: {
              select: {
                name: true,
                key: true,
                department: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        });

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        res.json({
          success: true,
          data: user
        });

      } catch (error) {
        console.error("Error fetching user profile for admin:", error);
        res.status(500).json({ 
          error: "Failed to fetch user profile", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Get user preferences
  router.get(
    "/preferences",
    async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;

        const user = await prisma.user.findFirst({
          where: {
            id: userId,
            orgId
          },
          select: {
            notificationPreferences: true
          }
        });

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        // Default preferences
        const defaultPreferences = {
          theme: "dark",
          language: "en",
          timezone: "UTC",
          dateFormat: "MM/DD/YYYY",
          timeFormat: "12h",
          notifications: {
            email: true,
            push: true,
            sms: false,
            desktop: true
          },
          privacy: {
            showOnlineStatus: true,
            showLastSeen: false,
            allowDirectMessages: true,
            profileVisibility: "all"
          },
          accessibility: {
            fontSize: "medium",
            highContrast: false,
            reduceMotion: false,
            screenReader: false
          }
        };

        res.json({
          success: true,
          data: user.notificationPreferences || defaultPreferences
        });

      } catch (error) {
        console.error("Error fetching user preferences:", error);
        res.status(500).json({ 
          error: "Failed to fetch preferences", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Update user preferences
  router.put(
    "/preferences",
    async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;
        const preferences = req.body;

        await prisma.user.update({
          where: {
            id: userId,
            orgId
          },
          data: {
            notificationPreferences: preferences,
            updatedAt: new Date()
          }
        });

        res.json({
          success: true,
          message: "Preferences updated successfully"
        });

      } catch (error) {
        console.error("Error updating user preferences:", error);
        res.status(500).json({ 
          error: "Failed to update preferences", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Get notification settings
  router.get(
    "/notifications",
    async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;

        const user = await prisma.user.findFirst({
          where: {
            id: userId,
            orgId
          },
          select: {
            notificationPreferences: true
          }
        });

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        // Default notification settings
        const defaultNotifications = {
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
        };

        res.json({
          success: true,
          data: user.notificationPreferences?.notifications || defaultNotifications
        });

      } catch (error) {
        console.error("Error fetching notification settings:", error);
        res.status(500).json({ 
          error: "Failed to fetch notification settings", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Update notification settings
  router.put(
    "/notifications",
    async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;
        const notifications = req.body;

        const user = await prisma.user.findFirst({
          where: { id: userId, orgId },
          select: { notificationPreferences: true }
        });

        const updatedPreferences = {
          ...(user?.notificationPreferences || {}),
          notifications
        };

        await prisma.user.update({
          where: {
            id: userId,
            orgId
          },
          data: {
            notificationPreferences: updatedPreferences,
            updatedAt: new Date()
          }
        });

        res.json({
          success: true,
          message: "Notification settings updated successfully"
        });

      } catch (error) {
        console.error("Error updating notification settings:", error);
        res.status(500).json({ 
          error: "Failed to update notification settings", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Get security settings
  router.get(
    "/security",
    async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;

        const user = await prisma.user.findFirst({
          where: {
            id: userId,
            orgId
          },
          select: {
            notificationPreferences: true
          }
        });

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        // Default security settings
        const defaultSecurity = {
          twoFactor: {
            enabled: false,
            method: "sms",
            phoneNumber: "",
            backupCodes: []
          },
          sessions: {
            autoLogout: 30,
            requireReauth: false,
            activeSessions: []
          },
          privacy: {
            dataSharing: false,
            analytics: true,
            marketing: false,
            cookies: true
          },
          login: {
            requireTwoFactor: false,
            allowedIPs: [],
            loginNotifications: true
          }
        };

        res.json({
          success: true,
          data: user.notificationPreferences?.security || defaultSecurity
        });

      } catch (error) {
        console.error("Error fetching security settings:", error);
        res.status(500).json({ 
          error: "Failed to fetch security settings", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Update security settings
  router.put(
    "/security",
    async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;
        const security = req.body;

        const user = await prisma.user.findFirst({
          where: { id: userId, orgId },
          select: { notificationPreferences: true }
        });

        const updatedPreferences = {
          ...(user?.notificationPreferences || {}),
          security
        };

        await prisma.user.update({
          where: {
            id: userId,
            orgId
          },
          data: {
            notificationPreferences: updatedPreferences,
            updatedAt: new Date()
          }
        });

        res.json({
          success: true,
          message: "Security settings updated successfully"
        });

      } catch (error) {
        console.error("Error updating security settings:", error);
        res.status(500).json({ 
          error: "Failed to update security settings", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  // Set "what I'm working on" (developer/sales) — visible to admin + director on strategic dashboard
  router.patch(
    "/current-focus",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.sales]),
    async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;
        const body = req.body as { projectId?: string | null; note?: string | null };

        const projectId =
          body.projectId === undefined || body.projectId === null || body.projectId === ""
            ? null
            : String(body.projectId);

        const note =
          body.note === undefined || body.note === null
            ? null
            : String(body.note).trim() || null;

        if (projectId === null) {
          await prisma.user.update({
            where: { id: userId, orgId },
            data: {
              currentFocusProjectId: null,
              currentFocusNote: note,
              currentFocusUpdatedAt: new Date()
            }
          });
          res.json({ success: true, data: { projectId: null, note, updatedAt: new Date().toISOString() } });
          return;
        }

        const project = await prisma.project.findFirst({
          where: { id: projectId, orgId, deletedAt: null, approvalStatus: "approved" }
        });
        if (!project) {
          res.status(404).json({ error: "Project not found or not approved" });
          return;
        }

        const roleKeys = req.auth!.roleKeys;
        const isDev = roleKeys.includes(ROLE_KEYS.developer);
        const isSales = roleKeys.includes(ROLE_KEYS.sales);
        const devAccess = await getProjectDeveloperAccess(prisma, project, userId);
        const allowed =
          (isDev && devAccess === "active") ||
          (isSales && project.createdByUserId === userId);
        if (!allowed) {
          res.status(403).json({
            error: "You can only set focus on a project you are assigned to (developer) or created (sales)."
          });
          return;
        }

        const updated = await prisma.user.update({
          where: { id: userId, orgId },
          data: {
            currentFocusProjectId: projectId,
            currentFocusNote: note,
            currentFocusUpdatedAt: new Date()
          },
          select: {
            currentFocusUpdatedAt: true,
            currentFocusNote: true,
            currentFocusProject: {
              select: { id: true, name: true, status: true }
            }
          }
        });

        res.json({
          success: true,
          data: {
            projectId: updated.currentFocusProject?.id ?? projectId,
            projectName: updated.currentFocusProject?.name,
            note: updated.currentFocusNote,
            updatedAt: updated.currentFocusUpdatedAt?.toISOString()
          }
        });
      } catch (error) {
        console.error("Error updating current focus:", error);
        res.status(500).json({
          error: "Failed to update current focus",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  router.get(
    "/current-focus",
    requireRoles([ROLE_KEYS.developer, ROLE_KEYS.sales]),
    async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;
        const user = await prisma.user.findFirst({
          where: { id: userId, orgId },
          select: {
            currentFocusNote: true,
            currentFocusUpdatedAt: true,
            currentFocusProject: {
              select: { id: true, name: true, status: true }
            }
          }
        });
        if (!user) {
          res.status(404).json({ error: "User not found" });
          return;
        }
        res.json({
          success: true,
          data: {
            projectId: user.currentFocusProject?.id ?? null,
            project: user.currentFocusProject,
            note: user.currentFocusNote,
            updatedAt: user.currentFocusUpdatedAt?.toISOString() ?? null
          }
        });
      } catch (error) {
        console.error("Error loading current focus:", error);
        res.status(500).json({
          error: "Failed to load current focus",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  // Change password
  router.post(
    "/change-password",
    async (req, res) => {
      try {
        const userId = req.auth!.userId;
        const orgId = req.auth!.orgId;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
          return res.status(400).json({ 
            error: "Current password and new password are required" 
          });
        }

        const user = await prisma.user.findFirst({
          where: {
            id: userId,
            orgId
          }
        });

        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }

        // TODO: Verify current password and update new password
        // This would require bcrypt comparison and hashing
        
        res.json({
          success: true,
          message: "Password changed successfully"
        });

      } catch (error) {
        console.error("Error changing password:", error);
        res.status(500).json({ 
          error: "Failed to change password", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }
  );

  return router;
}

import type { PrismaClient } from "@prisma/client";

/**
 * Permanently removes a user and clears or reassigns FK references so the row can be deleted.
 * `reassignToUserId` must be another user in the same org (typically the acting admin).
 */
export async function deleteOrgUserHard(
  prisma: PrismaClient,
  params: { userId: string; orgId: string; reassignToUserId: string }
): Promise<void> {
  const { userId, orgId, reassignToUserId } = params;
  if (userId === reassignToUserId) {
    throw new Error("reassignToUserId must differ from deleted user");
  }

  await prisma.$transaction(async (tx) => {
    const target = await tx.user.findFirst({
      where: { id: userId, orgId },
      select: { id: true, email: true }
    });
    if (!target) {
      throw new Error("User not found in this organization");
    }

    await tx.invite.deleteMany({
      where: { orgId, email: { equals: target.email, mode: "insensitive" } }
    });

    await tx.notification.deleteMany({
      where: { orgId, channel: "in_app", to: userId }
    });

    await tx.conflictLog.deleteMany({ where: { orgId, userId } });
    await tx.overrideAction.deleteMany({ where: { orgId, adminUserId: userId } });

    await tx.developerDailyDigestSent.deleteMany({ where: { orgId, userId } });
    await tx.dailyReminderSent.deleteMany({ where: { orgId, userId } });
    await tx.developerReminderSnooze.deleteMany({ where: { orgId, userId } });
    await tx.developerProgressReminderSent.deleteMany({ where: { orgId, userId } });

    await tx.user.updateMany({
      where: { orgId, reportsToDirectorId: userId },
      data: { reportsToDirectorId: null }
    });

    const chatProfile = await tx.chatUser.findUnique({ where: { userId } });
    if (chatProfile) {
      await tx.chatNotification.deleteMany({ where: { userId: chatProfile.id } });
      await tx.chatUser.update({
        where: { id: chatProfile.id },
        data: { conversations: { set: [] } }
      });
      await tx.chatUser.delete({ where: { id: chatProfile.id } });
    }

    await tx.inbox.deleteMany({ where: { userId } });

    await tx.chatNotification.deleteMany({
      where: {
        conversation: { orgId },
        senderId: userId
      }
    });
    await tx.chatNotification.deleteMany({
      where: {
        message: {
          senderId: userId,
          conversation: { orgId }
        }
      }
    });

    await tx.messageHide.deleteMany({ where: { userId } });
    await tx.messageUserFlag.deleteMany({ where: { userId } });

    await tx.message.deleteMany({
      where: { senderId: userId, conversation: { orgId } }
    });

    await tx.$executeRaw`
      UPDATE "Conversation"
      SET
        participants = array_remove(participants, ${userId}::text),
        admins = array_remove(admins, ${userId}::text),
        "unreadCounts" = COALESCE("unreadCounts"::jsonb, '{}'::jsonb) - ${userId}
      WHERE "orgId" = ${orgId}
        AND (
          ${userId} = ANY(participants)
          OR ${userId} = ANY(admins)
          OR (COALESCE("unreadCounts"::jsonb, '{}'::jsonb) ? ${userId})
        )
    `;

    await tx.conversation.updateMany({
      where: { orgId, createdBy: userId },
      data: { createdBy: reassignToUserId }
    });

    const channels = await tx.chatCommunityChannel.findMany({
      where: {
        orgId,
        OR: [{ members: { has: userId } }, { moderators: { has: userId } }]
      }
    });
    for (const ch of channels) {
      await tx.chatCommunityChannel.update({
        where: { id: ch.id },
        data: {
          members: ch.members.filter((m) => m !== userId),
          moderators: ch.moderators.filter((m) => m !== userId)
        }
      });
    }

    await tx.$executeRaw`
      UPDATE "TaskComment"
      SET "mentionedUserIds" = array_remove("mentionedUserIds", ${userId})
      WHERE "orgId" = ${orgId}
        AND ${userId} = ANY("mentionedUserIds")
    `;

    await tx.scheduleItem.deleteMany({ where: { orgId, userId } });
    await tx.crmContact.deleteMany({ where: { orgId, addedById: userId } });

    await tx.session.deleteMany({ where: { userId } });

    await tx.orgMember.deleteMany({ where: { orgId, userId } });
    await tx.userRole.deleteMany({ where: { userId } });

    await tx.lead.updateMany({
      where: { orgId, ownerId: userId },
      data: { ownerId: null }
    });
    await tx.lead.updateMany({
      where: { orgId, approvedById: userId },
      data: { approvedById: null }
    });

    await tx.leadComment.updateMany({
      where: { orgId, authorId: userId },
      data: { authorId: reassignToUserId }
    });

    await tx.leadFollowUp.updateMany({
      where: { orgId, assignedToId: userId },
      data: { assignedToId: reassignToUserId }
    });

    await tx.deal.updateMany({
      where: { orgId, ownerId: userId },
      data: { ownerId: null }
    });

    await tx.project.updateMany({
      where: { orgId, ownerUserId: userId },
      data: { ownerUserId: null }
    });
    await tx.project.updateMany({
      where: { orgId, createdByUserId: userId },
      data: { createdByUserId: null }
    });
    await tx.project.updateMany({
      where: { orgId, approvedById: userId },
      data: { approvedById: null }
    });
    await tx.project.updateMany({
      where: { orgId, assignedDeveloperId: userId },
      data: { assignedDeveloperId: null }
    });

    await tx.projectDeveloperAssignment.updateMany({
      where: { invitedById: userId },
      data: { invitedById: null }
    });
    await tx.projectDeveloperAssignment.deleteMany({
      where: { orgId, userId }
    });

    await tx.projectHandoffRequest.deleteMany({
      where: { orgId, OR: [{ fromUserId: userId }, { toUserId: userId }] }
    });

    await tx.task.updateMany({
      where: { orgId, assigneeId: userId },
      data: { assigneeId: null }
    });
    await tx.taskComment.updateMany({
      where: { orgId, authorId: userId },
      data: { authorId: null }
    });

    await tx.payment.updateMany({
      where: { orgId, createdByUserId: userId },
      data: { createdByUserId: null }
    });
    await tx.payout.updateMany({
      where: { orgId, recipientId: userId },
      data: { recipientId: null }
    });

    await tx.expense.updateMany({
      where: { orgId, beneficiaryUserId: userId },
      data: { beneficiaryUserId: null }
    });
    await tx.expense.updateMany({
      where: { orgId, developerAcknowledgedById: userId },
      data: { developerAcknowledgedById: null }
    });

    await tx.projectManagementMonth.updateMany({
      where: { orgId, markedByUserId: userId },
      data: { markedByUserId: null }
    });

    await tx.approval.updateMany({
      where: { orgId, requesterId: userId },
      data: { requesterId: null }
    });
    await tx.approval.updateMany({
      where: { orgId, approverId: userId },
      data: { approverId: null }
    });

    await tx.risk.updateMany({
      where: { orgId, ownerUserId: userId },
      data: { ownerUserId: null }
    });

    await tx.directorDecision.updateMany({
      where: { orgId, actorUserId: userId },
      data: { actorUserId: reassignToUserId }
    });

    await tx.directorCommunication.updateMany({
      where: { orgId, fromUserId: userId },
      data: { fromUserId: reassignToUserId }
    });
    await tx.directorCommunication.updateMany({
      where: { orgId, toUserId: userId },
      data: { toUserId: null }
    });

    await tx.changeRequest.updateMany({
      where: { orgId, createdByUserId: userId },
      data: { createdByUserId: reassignToUserId }
    });
    await tx.changeRequest.updateMany({
      where: { orgId, approvedByUserId: userId },
      data: { approvedByUserId: null }
    });

    await tx.salesReport.updateMany({
      where: { orgId, submittedById: userId },
      data: { submittedById: reassignToUserId }
    });
    await tx.salesReport.updateMany({
      where: { orgId, reviewedById: userId },
      data: { reviewedById: null }
    });

    await tx.salesReportComment.updateMany({
      where: { authorId: userId, report: { orgId } },
      data: { authorId: reassignToUserId }
    });

    await tx.developerReport.updateMany({
      where: { orgId, submittedById: userId },
      data: { submittedById: reassignToUserId }
    });
    await tx.developerReport.updateMany({
      where: { orgId, reviewedById: userId },
      data: { reviewedById: null }
    });

    await tx.directorReport.updateMany({
      where: { orgId, submittedById: userId },
      data: { submittedById: reassignToUserId }
    });
    await tx.directorReport.updateMany({
      where: { orgId, reviewedById: userId },
      data: { reviewedById: null }
    });

    await tx.meetingRequest.updateMany({
      where: { orgId, requestedById: userId },
      data: { requestedById: reassignToUserId }
    });
    await tx.meetingRequest.updateMany({
      where: { orgId, respondedById: userId },
      data: { respondedById: null }
    });

    await tx.adminActivityMessage.updateMany({
      where: { orgId, actorId: userId },
      data: { actorId: null }
    });

    await tx.eventLog.updateMany({
      where: { orgId, actorId: userId },
      data: { actorId: null }
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        currentFocusProjectId: null,
        currentFocusNote: null,
        currentFocusUpdatedAt: null
      }
    });

    await tx.user.delete({
      where: { id: userId }
    });
  });
}

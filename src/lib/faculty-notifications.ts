import { prisma } from "@/lib/prisma";

export async function createFacultyNotification(input: {
  recipientUserId?: number | null;
  recipientTeacherId?: number | null;
  eventType: string;
  title: string;
  message: string;
  createdByUserId?: number | null;
}) {
  return prisma.notifications.create({
    data: {
      recipient_user_id: input.recipientUserId ?? null,
      recipient_teacher_id: input.recipientTeacherId ?? null,
      event_type: input.eventType,
      title: input.title,
      message: input.message,
      created_by_user_id: input.createdByUserId ?? null,
    },
  });
}

export async function markNotificationRead(notificationId: number) {
  return prisma.notifications.update({
    where: { id: notificationId },
    data: {
      is_read: true,
      read_at: new Date(),
    },
  });
}
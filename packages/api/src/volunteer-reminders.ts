import {
  CommunicationChannel,
  CommunicationProvider,
  VolunteerShiftAssignmentStatus,
  prisma,
} from '@faithflow-ai/database';

type ReminderResult = {
  scanned: number;
  scheduled: number;
  skipped: number;
};

export async function scheduleVolunteerShiftReminders(hoursAhead = 24, limit = 200): Promise<ReminderResult> {
  const now = new Date();
  const horizon = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  const assignments = await prisma.volunteerShiftAssignment.findMany({
    where: {
      status: { in: [VolunteerShiftAssignmentStatus.SCHEDULED, VolunteerShiftAssignmentStatus.CONFIRMED] },
      shift: {
        startAt: { gte: now, lte: horizon },
      },
    },
    include: {
      member: true,
      shift: { include: { role: true, church: true } },
    },
    orderBy: { assignedAt: 'asc' },
    take: limit,
  });

  let scheduled = 0;
  let skipped = 0;

  for (const assignment of assignments) {
    if (assignment.lastReminderAt && assignment.lastReminderAt > new Date(now.getTime() - 12 * 60 * 60 * 1000)) {
      skipped += 1;
      continue;
    }

    const email = assignment.member.email;
    const phone = assignment.member.phone;
    if (!email && !phone) {
      skipped += 1;
      continue;
    }

    const channel = email ? CommunicationChannel.EMAIL : CommunicationChannel.SMS;
    const to = email ?? phone!;

    const subject = `Volunteer reminder: ${assignment.shift.title}`;
    const body = `
      <p>Hi ${assignment.member.preferredName ?? assignment.member.firstName},</p>
      <p>This is a reminder for your volunteer shift.</p>
      <ul>
        <li>Role: ${assignment.shift.role.name}</li>
        <li>When: ${assignment.shift.startAt.toLocaleString()}</li>
        <li>Where: ${assignment.shift.church.name}</li>
      </ul>
      <p>Thank you for serving!</p>
    `;

    await prisma.communicationSchedule.create({
      data: {
        churchId: assignment.shift.churchId,
        channel,
        provider: channel === CommunicationChannel.EMAIL ? CommunicationProvider.RESEND : CommunicationProvider.TWILIO,
        to,
        subject,
        body,
        sendAt: now,
        metadata: {
          type: 'volunteer.reminder',
          assignmentId: assignment.id,
          shiftId: assignment.shiftId,
        },
      },
    });

    await prisma.volunteerShiftAssignment.update({
      where: { id: assignment.id },
      data: { lastReminderAt: now },
    });

    scheduled += 1;
  }

  return { scanned: assignments.length, scheduled, skipped };
}

import {
  AuditActorType,
  CommunicationChannel,
  CommunicationProvider,
  prisma,
  UserRole,
  VolunteerShiftAssignmentStatus,
} from '@faithflow-ai/database';
import { recordAuditLog } from './audit';

type GapAlertResult = {
  scanned: number;
  alerted: number;
  skipped: number;
};

export async function scheduleVolunteerGapAlerts(hoursAhead = 48, limit = 200): Promise<GapAlertResult> {
  const now = new Date();
  const horizon = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  const shifts = await prisma.volunteerShift.findMany({
    where: {
      startAt: { gte: now, lte: horizon },
    },
    include: {
      church: { include: { organization: true } },
      role: true,
      assignments: true,
    },
    orderBy: { startAt: 'asc' },
    take: limit,
  });

  let alerted = 0;
  let skipped = 0;

  for (const shift of shifts) {
    if (!shift.capacity) {
      skipped += 1;
      continue;
    }

    const assigned = shift.assignments.filter((assignment) => assignment.status !== VolunteerShiftAssignmentStatus.CANCELED).length;
    const remaining = Math.max(shift.capacity - assigned, 0);
    if (remaining <= 0) {
      skipped += 1;
      continue;
    }

    const stage = shift.startAt.getTime() - now.getTime() <= 24 * 60 * 60 * 1000 ? 'urgent' : 'soon';
    const existingAlert = await prisma.auditLog.findFirst({
      where: {
        targetType: 'VolunteerShift',
        targetId: shift.id,
        action: `volunteer.shift.alert.${stage}`,
      },
      select: { id: true },
    });
    if (existingAlert) {
      skipped += 1;
      continue;
    }

    const staff = await prisma.staffMembership.findMany({
      where: {
        churchId: shift.churchId,
        role: { in: [UserRole.ADMIN, UserRole.STAFF] },
      },
      include: { user: true },
    });
    const recipients = Array.from(
      new Set(
        staff
          .map((membership) => membership.user?.email)
          .filter((email): email is string => Boolean(email))
      )
    );

    if (!recipients.length) {
      skipped += 1;
      continue;
    }

    const subject =
      stage === 'urgent'
        ? `Urgent: ${remaining} volunteer slots open (${shift.title})`
        : `Volunteer slots open (${remaining} needed)`;

    const body = `
      <p><strong>${remaining} volunteer slots are still open.</strong></p>
      <ul>
        <li>Shift: ${shift.title}</li>
        <li>Role: ${shift.role.name}</li>
        <li>When: ${shift.startAt.toLocaleString()} - ${shift.endAt.toLocaleString()}</li>
      </ul>
      <p>Open FaithFlow Admin → Members → Volunteer shifts to assign coverage.</p>
    `;

    await prisma.communicationSchedule.createMany({
      data: recipients.map((to) => ({
        churchId: shift.churchId,
        channel: CommunicationChannel.EMAIL,
        provider: CommunicationProvider.RESEND,
        to,
        subject,
        body,
        sendAt: now,
        metadata: {
          type: 'volunteer.shift.alert',
          stage,
          shiftId: shift.id,
          remaining,
        },
      })),
    });

    await recordAuditLog({
      tenantId: shift.church?.organization.tenantId ?? null,
      churchId: shift.churchId,
      actorType: AuditActorType.SYSTEM,
      action: `volunteer.shift.alert.${stage}`,
      targetType: 'VolunteerShift',
      targetId: shift.id,
      metadata: { remaining, startAt: shift.startAt.toISOString() },
    });

    alerted += 1;
  }

  return { scanned: shifts.length, alerted, skipped };
}

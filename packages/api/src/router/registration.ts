import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { MemberStatus, RegistrationStatus, prisma } from '@faithflow-ai/database';
import { TRPCError } from '@trpc/server';
import { createHash, randomBytes } from 'crypto';
import { sendEmail } from '../email';

const registerSchema = z.object({
  churchId: z.string().optional(),
  churchSlug: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  preferredName: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
});

const verifySchema = z.object({
  registrationId: z.string(),
  token: z.string(),
});

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export const registrationRouter = router({
  start: publicProcedure
    .input(registerSchema)
    .mutation(async ({ input }) => {
      const church = await prisma.church.findFirst({
        where: {
          ...(input.churchId ? { id: input.churchId } : {}),
          ...(input.churchSlug ? { slug: input.churchSlug } : {}),
        },
      });

      if (!church) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Church not found' });
      }

      const email = input.email.toLowerCase();
      let member = await prisma.member.findFirst({
        where: { churchId: church.id, email },
      });

      if (member && member.status === MemberStatus.ACTIVE) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Member is already active' });
      }

      if (!member) {
        member = await prisma.member.create({
          data: {
            churchId: church.id,
            firstName: input.firstName,
            lastName: input.lastName,
            preferredName: input.preferredName,
            email,
            phone: input.phone,
            status: MemberStatus.INACTIVE,
          },
        });
      } else {
        member = await prisma.member.update({
          where: { id: member.id },
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            preferredName: input.preferredName,
            phone: input.phone ?? member.phone,
          },
        });
      }

      const token = randomBytes(24).toString('hex');
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const registration = await prisma.memberRegistration.upsert({
        where: { memberId: member.id },
        update: {
          email,
          tokenHash,
          status: RegistrationStatus.PENDING,
          expiresAt,
          verifiedAt: null,
        },
        create: {
          churchId: church.id,
          memberId: member.id,
          email,
          tokenHash,
          status: RegistrationStatus.PENDING,
          expiresAt,
        },
      });

      const baseUrl = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
      const verificationLink = `${baseUrl}/register/verify?registrationId=${registration.id}&token=${token}`;

      let delivery: 'EMAIL' | 'MANUAL' = 'MANUAL';
      if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
        try {
          await sendEmail({
            to: email,
            subject: `Verify your FaithFlow membership`,
            html: `<p>Hello ${input.firstName},</p><p>Please verify your membership registration for ${church.name}.</p><p><a href="${verificationLink}">Verify membership</a></p>`,
          });
          delivery = 'EMAIL';
        } catch (error) {
          delivery = 'MANUAL';
        }
      }

      return {
        registrationId: registration.id,
        delivery,
        verificationLink: delivery === 'MANUAL' ? verificationLink : undefined,
        expiresAt,
      };
    }),

  verify: publicProcedure
    .input(verifySchema)
    .mutation(async ({ input }) => {
      const registration = await prisma.memberRegistration.findUnique({
        where: { id: input.registrationId },
      });

      if (!registration) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Registration not found' });
      }

      if (registration.status === RegistrationStatus.VERIFIED) {
        return { status: RegistrationStatus.VERIFIED };
      }

      if (registration.expiresAt < new Date()) {
        await prisma.memberRegistration.update({
          where: { id: registration.id },
          data: { status: RegistrationStatus.EXPIRED },
        });
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Verification link expired' });
      }

      const tokenHash = hashToken(input.token);
      if (tokenHash !== registration.tokenHash) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid verification token' });
      }

      await prisma.$transaction([
        prisma.memberRegistration.update({
          where: { id: registration.id },
          data: { status: RegistrationStatus.VERIFIED, verifiedAt: new Date() },
        }),
        prisma.member.update({
          where: { id: registration.memberId },
          data: { status: MemberStatus.ACTIVE },
        }),
      ]);

      return { status: RegistrationStatus.VERIFIED };
    }),

  resend: protectedProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const member = await prisma.member.findFirst({
        where: { id: input.memberId, church: { organization: { tenantId: ctx.tenantId! } } },
      });
      if (!member || !member.email) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found or missing email' });
      }

      const church = await prisma.church.findUnique({ where: { id: member.churchId } });
      const churchName = church?.name ?? 'your church';

      const registration = await prisma.memberRegistration.findFirst({
        where: { memberId: member.id },
      });
      if (!registration) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Registration not found' });
      }

      const token = randomBytes(24).toString('hex');
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const updated = await prisma.memberRegistration.update({
        where: { id: registration.id },
        data: { tokenHash, status: RegistrationStatus.PENDING, expiresAt, verifiedAt: null },
      });

      const baseUrl = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
      const verificationLink = `${baseUrl}/register/verify?registrationId=${updated.id}&token=${token}`;

      if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
        await sendEmail({
          to: member.email,
          subject: `Verify your FaithFlow membership`,
          html: `<p>Hello ${member.firstName},</p><p>Please verify your membership registration for ${churchName}.</p><p><a href="${verificationLink}">Verify membership</a></p>`,
        });
      }

      return { verificationLink };
    }),
});

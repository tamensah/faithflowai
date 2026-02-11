import { router } from '../trpc';
import { healthRouter } from './health';
import { organizationRouter } from './organization';
import { authRouter } from './auth';
import { staffRouter } from './staff';
import { platformRouter } from './platform';
import { churchRouter } from './church';
import { campusRouter } from './campus';
import { memberRouter } from './member';
import { householdRouter } from './household';
import { groupRouter } from './group';
import { memberTagRouter } from './member-tag';
import { memberMilestoneRouter } from './member-milestone';
import { relationshipRouter } from './relationship';
import { volunteerRouter } from './volunteer';
import { onboardingRouter } from './onboarding';
import { surveyRouter } from './survey';
import { eventRouter } from './event';
import { attendanceRouter } from './attendance';
import { messagingRouter } from './messaging';
import { notificationsRouter } from './notifications';
import { registrationRouter } from './registration';
import { donationRouter } from './donation';
import { fundRouter } from './fund';
import { campaignRouter } from './campaign';
import { fundraiserRouter } from './fundraiser';
import { auditRouter } from './audit';
import { textToGiveRouter } from './text-to-give';
import { communicationsRouter } from './communications';
import { insightsRouter } from './insights';
import { givingRouter } from './giving';
import { receiptRouter } from './receipt';
import { financeRouter } from './finance';
import { pledgeRouter } from './pledge';
import { recurringRouter } from './recurring';
import { expenseCategoryRouter } from './expense-category';
import { expenseRouter } from './expense';
import { budgetRouter } from './budget';
import { storageRouter } from './storage';
import { facilityRouter } from './facility';
import { operationsRouter } from './operations';
import { careRouter } from './care';
import { contentRouter } from './content';
import { billingRouter } from './billing';
import { tenantOpsRouter } from './tenant-ops';
import { supportRouter } from './support';
import { streamingRouter } from './streaming';

export const appRouter = router({
  auth: authRouter,
  staff: staffRouter,
  platform: platformRouter,
  health: healthRouter,
  organization: organizationRouter,
  church: churchRouter,
  campus: campusRouter,
  member: memberRouter,
  household: householdRouter,
  group: groupRouter,
  memberTag: memberTagRouter,
  memberMilestone: memberMilestoneRouter,
  relationship: relationshipRouter,
  volunteer: volunteerRouter,
  onboarding: onboardingRouter,
  survey: surveyRouter,
  event: eventRouter,
  attendance: attendanceRouter,
  messaging: messagingRouter,
  notifications: notificationsRouter,
  registration: registrationRouter,
  donation: donationRouter,
  fund: fundRouter,
  campaign: campaignRouter,
  fundraiser: fundraiserRouter,
  audit: auditRouter,
  textToGive: textToGiveRouter,
  communications: communicationsRouter,
  insights: insightsRouter,
  giving: givingRouter,
  receipt: receiptRouter,
  finance: financeRouter,
  pledge: pledgeRouter,
  recurring: recurringRouter,
  expenseCategory: expenseCategoryRouter,
  expense: expenseRouter,
  budget: budgetRouter,
  storage: storageRouter,
  facility: facilityRouter,
  operations: operationsRouter,
  care: careRouter,
  content: contentRouter,
  billing: billingRouter,
  tenantOps: tenantOpsRouter,
  support: supportRouter,
  streaming: streamingRouter,
});

export type AppRouter = typeof appRouter;

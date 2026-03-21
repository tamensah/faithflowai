import Link from 'next/link';
import { Badge } from '@faithflow-ai/ui';

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <Badge variant="default">Legal</Badge>
      <h1 className="mt-5 text-4xl font-semibold text-foreground">Privacy policy</h1>
      <p className="mt-3 text-sm text-muted">Last updated: {new Date().getFullYear()}</p>

      <div className="prose prose-sm mt-10 max-w-none text-muted">
        <p>
          FaithFlow AI takes the privacy of your church and congregation data seriously. This policy
          explains what data we collect, how we use it, and the controls you have over it.
        </p>

        <h2 className="mt-8 text-base font-semibold text-foreground">Data we collect</h2>
        <p>
          We collect information you provide directly — including church organization details, staff
          accounts, member records, giving data, and event registrations. We also collect usage data
          to improve the platform.
        </p>

        <h2 className="mt-8 text-base font-semibold text-foreground">Tenant isolation</h2>
        <p>
          Every church's data is strictly isolated at the database level using row-level security
          policies. No church can access another church's data. Platform administrators can access
          aggregate operational data only.
        </p>

        <h2 className="mt-8 text-base font-semibold text-foreground">Third-party services</h2>
        <p>
          We use Clerk for identity and authentication, Stripe and Paystack for payment processing,
          Resend for email delivery, and Twilio for SMS. Each provider is bound by their own privacy
          commitments and is chosen for their security posture.
        </p>

        <h2 className="mt-8 text-base font-semibold text-foreground">Data retention</h2>
        <p>
          Your data is retained for the lifetime of your subscription plus a 90-day grace period.
          You may request full data export or deletion at any time by contacting us.
        </p>

        <h2 className="mt-8 text-base font-semibold text-foreground">Your rights</h2>
        <p>
          Church admins may export, correct, or delete any member data from the admin console.
          Members may update or remove their own profile data from the member portal at any time.
        </p>

        <h2 className="mt-8 text-base font-semibold text-foreground">Contact</h2>
        <p>
          For privacy questions or data requests, use our{' '}
          <Link href="/contact" className="text-primary underline">contact form</Link>.
        </p>
      </div>
    </main>
  );
}

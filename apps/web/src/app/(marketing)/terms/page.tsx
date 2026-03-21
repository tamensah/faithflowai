import Link from 'next/link';
import { Badge } from '@faithflow-ai/ui';

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <Badge variant="default">Legal</Badge>
      <h1 className="mt-5 text-4xl font-semibold text-foreground">Terms of service</h1>
      <p className="mt-3 text-sm text-muted">Last updated: {new Date().getFullYear()}</p>

      <div className="prose prose-sm mt-10 max-w-none text-muted">
        <p>
          By using FaithFlow AI you agree to these terms. Please read them carefully.
        </p>

        <h2 className="mt-8 text-base font-semibold text-foreground">Service</h2>
        <p>
          FaithFlow AI provides a cloud-based church management platform on a subscription basis.
          We reserve the right to modify, suspend, or discontinue features with reasonable notice.
        </p>

        <h2 className="mt-8 text-base font-semibold text-foreground">Accounts and access</h2>
        <p>
          You are responsible for maintaining the security of your account credentials. Each
          subscription covers one church organization. Multi-campus use is supported within a single
          organization subject to your plan limits.
        </p>

        <h2 className="mt-8 text-base font-semibold text-foreground">Acceptable use</h2>
        <p>
          FaithFlow AI may only be used for lawful purposes by religious organizations and their
          affiliates. You must not use the platform to process fraudulent transactions, send
          unsolicited communications, or circumvent access controls.
        </p>

        <h2 className="mt-8 text-base font-semibold text-foreground">Payment and billing</h2>
        <p>
          Subscriptions are billed in advance on a monthly or annual basis. Failed payments trigger
          a grace period after which access is restricted. You may cancel at any time; no refunds
          are issued for partial periods unless required by law.
        </p>

        <h2 className="mt-8 text-base font-semibold text-foreground">Data ownership</h2>
        <p>
          You own your church's data. FaithFlow AI acts as a data processor. We do not sell or
          share your data with third parties except as required to operate the service.
        </p>

        <h2 className="mt-8 text-base font-semibold text-foreground">Limitation of liability</h2>
        <p>
          FaithFlow AI is provided "as is". Our liability is limited to the fees paid in the three
          months preceding any claim. We are not liable for indirect, incidental, or consequential
          damages.
        </p>

        <h2 className="mt-8 text-base font-semibold text-foreground">Contact</h2>
        <p>
          Questions about these terms?{' '}
          <Link href="/contact" className="text-primary underline">Contact us</Link>.
        </p>
      </div>
    </main>
  );
}

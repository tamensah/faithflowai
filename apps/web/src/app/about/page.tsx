import { Badge, Card } from '@faithflow-ai/ui';

export default function AboutPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <Badge variant="default">About</Badge>
      <h1 className="mt-4 text-4xl font-semibold">FaithFlow AI is a modern church operating system.</h1>
      <p className="mt-3 max-w-3xl text-sm text-muted">
        We are building a resilient platform that helps churches run finance, membership, events, and communications
        with strong security, auditability, and AI-assisted workflows.
      </p>

      <section className="mt-8 grid gap-5 md:grid-cols-3">
        {[
          {
            title: 'Trustworthy by design',
            body: 'Tenant isolation, audit trails, and role-based access as defaults.',
          },
          {
            title: 'Built for every scale',
            body: 'Single location to multi-campus and diaspora networks with a consistent model.',
          },
          {
            title: 'AI with accountability',
            body: 'AI suggestions are reviewable, traceable, and designed to reduce admin load.',
          },
        ].map((card) => (
          <Card key={card.title} className="border-border bg-white p-6">
            <h2 className="text-xl font-semibold">{card.title}</h2>
            <p className="mt-3 text-sm text-muted">{card.body}</p>
          </Card>
        ))}
      </section>
    </main>
  );
}


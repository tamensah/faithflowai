"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Button, Card } from "@faithflow-ai/ui";
import { trpc } from "../../../../lib/trpc";

const adminBaseUrl = (
  process.env.NEXT_PUBLIC_ADMIN_URL ??
  "https://churchtrack-admin-git-develop-tamensahs-projects.vercel.app"
).replace(/\/+$/, "");

export default function CheckoutCompletePage() {
  const { isLoaded, isSignedIn, orgId } = useAuth();
  const utils = trpc.useUtils();
  const verificationStarted = useRef(false);
  const [verificationError, setVerificationError] = useState<string | null>(
    null,
  );
  const {
    data: subscription,
    isLoading,
    isError,
    refetch,
  } = trpc.billing.currentSubscription.useQuery(undefined, {
    enabled: Boolean(isSignedIn && orgId),
    refetchInterval: (query) => (query.state.data ? false : 3000),
  });
  const { mutate: verifyPaystackCheckout, isPending: isVerifyingPaystack } =
    trpc.billing.verifyPaystackCheckout.useMutation({
      onSuccess: async () => {
        setVerificationError(null);
        await utils.billing.currentSubscription.invalidate();
      },
      onError: (error) => setVerificationError(error.message),
    });

  useEffect(() => {
    if (!isSignedIn || !orgId || verificationStarted.current) return;
    verificationStarted.current = true;
    const url = new URL(window.location.href);
    const reference =
      url.searchParams.get("reference") ?? url.searchParams.get("trxref");
    if (!reference || url.searchParams.get("status") === "cancel") return;
    verifyPaystackCheckout({ reference });
  }, [isSignedIn, orgId, verifyPaystackCheckout]);

  const active =
    subscription?.status === "TRIALING" || subscription?.status === "ACTIVE";

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center px-6 py-16">
      <Card className="w-full p-8">
        <h1 className="text-2xl font-semibold text-foreground">
          Continue setting up your church
        </h1>
        {!isLoaded || isLoading || isVerifyingPaystack ? (
          <p className="mt-3 text-sm text-muted">Checking your subscription…</p>
        ) : !isSignedIn ? (
          <p className="mt-3 text-sm text-muted">
            Your web session has ended. Sign in again on ChurchTrack to check
            your subscription before continuing.
          </p>
        ) : !orgId ? (
          <p className="mt-3 text-sm text-muted">
            Select the organization you created to check its subscription.
          </p>
        ) : active ? (
          <p className="mt-3 text-sm text-muted">
            Your {subscription.status === "TRIALING" ? "trial" : "subscription"}{" "}
            is active. Next, name your first church and set its country in the
            admin workspace.
          </p>
        ) : isError || verificationError ? (
          <p className="mt-3 text-sm text-muted">
            We could not confirm your subscription yet.{" "}
            {verificationError ?? "Please retry in a moment."}
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Checkout has returned, but subscription activation is still being
            confirmed. This page will check again shortly.
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          {active ? (
            <a
              href={adminBaseUrl}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Open admin workspace
            </a>
          ) : (
            <Button
              variant="outline"
              onClick={() => void refetch()}
              disabled={!isSignedIn || !orgId}
            >
              Check again
            </Button>
          )}
        </div>
        {active ? (
          <p className="mt-4 text-xs text-muted">
            The admin preview uses a separate address, so it may ask you to sign
            in once more with the same account.
          </p>
        ) : null}
        {!active ? (
          <Link
            href="/get-started"
            className="mt-4 inline-block text-sm font-medium text-primary underline underline-offset-4"
          >
            Return to setup
          </Link>
        ) : null}
      </Card>
    </main>
  );
}

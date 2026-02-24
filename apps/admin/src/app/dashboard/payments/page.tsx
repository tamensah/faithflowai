import { PaymentConsole } from '@/components/payment/payment-console';

function hasEnv(name: string): boolean {
	return Boolean(process.env[name]?.trim());
}

export default function PaymentsPage() {
	const providerConfig = {
		stripeConfigured: hasEnv('STRIPE_SECRET_KEY') && hasEnv('STRIPE_WEBHOOK_SECRET'),
		paystackConfigured: hasEnv('PAYSTACK_SECRET_KEY'),
	};

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold text-slate-900">Payments</h1>
				<p className="mt-2 text-sm text-slate-600">
					Exercise payment mutations end-to-end from the admin dashboard.
				</p>
			</div>

			<PaymentConsole providerConfig={providerConfig} />
		</div>
	);
}

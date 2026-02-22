import { PaymentConsole } from '@/components/payment/payment-console';

export default function PaymentsPage() {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold text-slate-900">Payments</h1>
				<p className="mt-2 text-sm text-slate-600">
					Exercise payment mutations end-to-end from the admin dashboard.
				</p>
			</div>

			<PaymentConsole />
		</div>
	);
}

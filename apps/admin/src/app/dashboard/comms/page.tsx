import { CommsConsole } from '@/components/comms/comms-console';

function hasEnv(name: string): boolean {
	return Boolean(process.env[name]?.trim());
}

export default function CommsPage() {
	const providerConfig = {
		resendConfigured: hasEnv('RESEND_API_KEY') && hasEnv('RESEND_FROM_EMAIL'),
		twilioConfigured: hasEnv('TWILIO_ACCOUNT_SID') && hasEnv('TWILIO_AUTH_TOKEN'),
		whatsappConfigured:
			hasEnv('TWILIO_ACCOUNT_SID') &&
			hasEnv('TWILIO_AUTH_TOKEN') &&
			hasEnv('TWILIO_WHATSAPP_NUMBER'),
	};

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold text-slate-900">Comms</h1>
				<p className="mt-2 text-sm text-slate-600">
					Run room messaging and outbound dispatch flows directly from the dashboard.
				</p>
			</div>

			<CommsConsole providerConfig={providerConfig} />
		</div>
	);
}

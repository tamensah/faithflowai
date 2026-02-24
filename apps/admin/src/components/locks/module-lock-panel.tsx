import Link from 'next/link';

type Cta = {
	label: string;
	href: string;
};

export function ModuleLockPanel(props: {
	title: string;
	reason: string;
	nextSteps: string[];
	cta: Cta[];
}) {
	return (
		<div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
			<p className="text-xs uppercase tracking-[0.16em] text-amber-700">Feature locked</p>
			<h2 className="mt-2 text-xl font-semibold text-amber-900">{props.title}</h2>
			<p className="mt-2 text-sm text-amber-800">{props.reason}</p>
			<div className="mt-4">
				<p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Next steps</p>
				<ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
					{props.nextSteps.map((step) => (
						<li key={step}>{step}</li>
					))}
				</ul>
			</div>
			<div className="mt-4 flex flex-wrap gap-2">
				{props.cta.map((item) => (
					<Link
						key={item.href}
						href={item.href}
						className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-900"
					>
						{item.label}
					</Link>
				))}
			</div>
		</div>
	);
}

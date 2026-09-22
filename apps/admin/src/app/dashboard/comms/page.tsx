import { redirect } from 'next/navigation';

export default function LegacyCommsRedirect() {
	redirect('/communications');
}

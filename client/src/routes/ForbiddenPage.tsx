import { ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";

export function ForbiddenPage() {
	return (
		<>
			<PageHeader title="Access denied" />
			<EmptyState
				icon={ShieldAlert}
				title="You don't have access to this page"
				description="This section is only available to administrators. Ask an administrator if you need access."
				action={
					<Link to="/" className="text-[13px] font-medium text-primary hover:underline">
						Back to dashboard
					</Link>
				}
			/>
		</>
	);
}

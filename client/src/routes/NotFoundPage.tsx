import { SearchX } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";

export function NotFoundPage() {
	return (
		<>
			<PageHeader title="Page not found" />
			<EmptyState
				icon={SearchX}
				title="This page doesn't exist"
				description="The link may be broken or the page may have been removed."
				action={
					<Link to="/" className="text-[13px] font-medium text-primary hover:underline">
						Back to dashboard
					</Link>
				}
			/>
		</>
	);
}

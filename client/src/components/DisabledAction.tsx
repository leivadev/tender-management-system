import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { Tooltip } from "./Tooltip";

/**
 * Stand-in for an action the current role cannot perform. Uses aria-disabled instead of `disabled`
 * so the button stays focusable and hoverable, which is what lets the tooltip explain why.
 */
export function DisabledAction({ children, reason }: { children: ReactNode; reason: string }) {
	return (
		<Tooltip content={reason}>
			<Button
				variant="secondary"
				aria-disabled="true"
				className="cursor-not-allowed opacity-50 hover:bg-card"
				onClick={(e) => e.preventDefault()}
			>
				<Lock className="size-3.5" aria-hidden="true" /> {children}
			</Button>
		</Tooltip>
	);
}

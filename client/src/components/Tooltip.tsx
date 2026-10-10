import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

/** Mount once near the app root so every tooltip shares the same open delay. */
export const TooltipProvider = ({ children }: { children: ReactNode }) => (
	<RadixTooltip.Provider delayDuration={200}>{children}</RadixTooltip.Provider>
);

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
	return (
		<RadixTooltip.Root>
			<RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
			<RadixTooltip.Portal>
				<RadixTooltip.Content
					sideOffset={6}
					className="z-50 max-w-xs rounded-ctl bg-foreground px-2.5 py-1.5 text-xs text-background shadow-card"
				>
					{content}
					<RadixTooltip.Arrow className="fill-foreground" />
				</RadixTooltip.Content>
			</RadixTooltip.Portal>
		</RadixTooltip.Root>
	);
}

export interface ConfirmOptions {
	title: string;
	description?: string;
	confirmLabel?: string;
	destructive?: boolean;
}

type Resolver = (value: boolean) => void;
type Listener = (state: { options: ConfirmOptions; resolve: Resolver } | null) => void;

let listener: Listener | null = null;

export function subscribeConfirm(fn: Listener): () => void {
	listener = fn;
	return () => {
		if (listener === fn) listener = null;
	};
}

/** Opens the app-wide confirmation dialog (mounted once in App). Resolves true on confirm. */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
	return new Promise((resolve) => {
		if (!listener) return resolve(window.confirm(options.title));
		listener({ options, resolve });
	});
}

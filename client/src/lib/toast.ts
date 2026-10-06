export type ToastVariant = "success" | "error";

export interface ToastMessage {
	id: number;
	message: string;
	variant: ToastVariant;
}

type Listener = (toasts: ToastMessage[]) => void;

let toasts: ToastMessage[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
	for (const listener of listeners) listener(toasts);
}

export function subscribeToasts(listener: Listener): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function getToasts(): ToastMessage[] {
	return toasts;
}

export function dismissToast(id: number) {
	toasts = toasts.filter((t) => t.id !== id);
	emit();
}

export function pushToast(message: string, variant: ToastVariant = "success") {
	const id = nextId++;
	toasts = [...toasts, { id, message, variant }];
	emit();
	setTimeout(() => dismissToast(id), 4000);
}

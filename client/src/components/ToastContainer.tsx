import { useSyncExternalStore } from "react";
import { dismissToast, getToasts, subscribeToasts } from "../lib/toast";

export function ToastContainer() {
	const toasts = useSyncExternalStore(subscribeToasts, getToasts);

	if (toasts.length === 0) return null;

	return (
		<div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
			{toasts.map((toast) => (
				<div
					key={toast.id}
					role={toast.variant === "error" ? "alert" : "status"}
					className={`flex items-start justify-between gap-3 rounded-md border px-4 py-3 text-sm shadow-lg ${
						toast.variant === "success"
							? "border-green-200 bg-green-50 text-green-800"
							: "border-red-200 bg-red-50 text-red-800"
					}`}
				>
					<span>{toast.message}</span>
					<button
						type="button"
						onClick={() => dismissToast(toast.id)}
						className="text-current opacity-60 hover:opacity-100"
						aria-label="Cerrar"
					>
						×
					</button>
				</div>
			))}
		</div>
	);
}

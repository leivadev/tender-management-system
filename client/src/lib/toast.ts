import { toast } from "sonner";

export type ToastVariant = "success" | "error";

export function pushToast(message: string, variant: ToastVariant = "success") {
	if (variant === "error") toast.error(message);
	else toast.success(message);
}

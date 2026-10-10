const base =
	"h-8 w-full rounded-ctl border bg-card px-2.5 text-[13px] text-foreground shadow-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70";

export const inputClass = `${base} border-border focus:border-primary focus:ring-primary/20`;

export const inputErrorClass = `${base} border-destructive focus:border-destructive focus:ring-destructive/20`;

export function fieldClass(hasError: boolean): string {
	return hasError ? inputErrorClass : inputClass;
}

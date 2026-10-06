export const inputClass =
	"w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export const inputErrorClass =
	"w-full rounded-md border border-red-400 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

export function fieldClass(hasError: boolean): string {
	return hasError ? inputErrorClass : inputClass;
}

/** Formats a date for `<input type="datetime-local">` in the user's local time. */
export function toLocalInputValue(date: Date): string {
	const local = new Date(date);
	local.setSeconds(0, 0);
	local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
	return local.toISOString().slice(0, 16);
}

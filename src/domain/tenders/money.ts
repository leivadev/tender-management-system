// Money is handled as integer cents inside the domain; floats only appear at the edges (BR-06).

export const toCents = (value: number) => Math.round(value * 100);

export const fromCents = (cents: number) => cents / 100;

/** Frozen line subtotal, exact to the cent. */
export const lineSubtotal = (unitPrice: number, quantity: number) => fromCents(toCents(unitPrice) * quantity);

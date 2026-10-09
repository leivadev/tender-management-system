const realFetch = globalThis.fetch;

// Resend payloads captured by the stub, so tests can assert on email content.
export const sentEmails: Array<{ subject: string; html: string; text: string }> = [];
(globalThis as { __sentEmails?: typeof sentEmails }).__sentEmails = sentEmails;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
	const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
	if (url.startsWith("https://api.resend.com/")) {
		if (typeof init?.body === "string") sentEmails.push(JSON.parse(init.body));
		return Response.json({ id: "test-email-id" });
	}
	return realFetch(input, init);
}) as typeof fetch;

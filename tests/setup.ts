const realFetch = globalThis.fetch;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
	const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
	if (url.startsWith("https://api.resend.com/")) {
		return Response.json({ id: "test-email-id" });
	}
	return realFetch(input, init);
}) as typeof fetch;

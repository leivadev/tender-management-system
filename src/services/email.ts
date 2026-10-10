import { Resend } from "resend";

type TenderProductLine = { name: string; quantity: number; unitPrice: string };

type TenderSummary = {
	title: string;
	clientEmail: string;
	clientName: string;
	maxBudget: string;
	deadline: Date;
	products: TenderProductLine[];
};

function arrayBufferToBase64(buffer: ArrayBuffer) {
	let binary = "";
	const bytes = new Uint8Array(buffer);
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

function formatCurrency(value: string | number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
	}).format(Number(value));
}

function formatDate(date: Date) {
	return new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZone: "UTC",
		timeZoneName: "short",
	}).format(date);
}

const EMAIL_STYLES = {
	body: "font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1f2933; line-height: 1.5; max-width: 560px; margin: 0 auto; padding: 24px;",
	heading: "font-size: 18px; margin: 0 0 16px;",
	table: "width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;",
	th: "text-align: left; padding: 8px; border-bottom: 2px solid #e4e7eb; color: #52606d;",
	td: "padding: 8px; border-bottom: 1px solid #e4e7eb;",
	tdRight: "padding: 8px; border-bottom: 1px solid #e4e7eb; text-align: right;",
	summary:
		"width: 100%; background: #f5f7fa; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px; border-collapse: collapse;",
	summaryLabel: "padding: 4px 0; text-align: left;",
	summaryValue: "padding: 4px 0; text-align: right;",
	footer: "font-size: 12px; color: #7b8794; margin-top: 24px;",
};

function summaryHtml(rows: Array<{ label: string; value: string }>) {
	return `
		<table style="${EMAIL_STYLES.summary}">
			${rows
				.map(
					(r) => `
				<tr>
					<td style="${EMAIL_STYLES.summaryLabel}"><strong>${r.label}</strong></td>
					<td style="${EMAIL_STYLES.summaryValue}">${r.value}</td>
				</tr>`,
				)
				.join("")}
		</table>
	`;
}

function productsTableHtml(products: TenderProductLine[]) {
	const rows = products
		.map(
			(p) => `
				<tr>
					<td style="${EMAIL_STYLES.td}">${p.name}</td>
					<td style="${EMAIL_STYLES.tdRight}">${p.quantity}</td>
					<td style="${EMAIL_STYLES.tdRight}">${formatCurrency(p.unitPrice)}</td>
				</tr>`,
		)
		.join("");

	return `
		<table style="${EMAIL_STYLES.table}">
			<thead>
				<tr>
					<th style="${EMAIL_STYLES.th}">Product</th>
					<th style="${EMAIL_STYLES.th}; text-align: right;">Quantity</th>
					<th style="${EMAIL_STYLES.th}; text-align: right;">Unit price</th>
				</tr>
			</thead>
			<tbody>${rows}</tbody>
		</table>
	`;
}

function productsTableText(products: TenderProductLine[]) {
	return products.map((p) => `- ${p.name}: ${p.quantity} x ${formatCurrency(p.unitPrice)}`).join("\n");
}

export async function sendTenderEmail(
	env: Env,
	tender: TenderSummary,
	proposal: { filename: string; content: ArrayBuffer; contentType: string },
) {
	const resend = new Resend(env.RESEND_API_KEY);

	const html = `
		<div style="${EMAIL_STYLES.body}">
			<p>Dear ${tender.clientName},</p>
			<h1 style="${EMAIL_STYLES.heading}">Tender: ${tender.title}</h1>
			<p>We are formally sending you the following tender:</p>
			${productsTableHtml(tender.products)}
			${summaryHtml([
				{ label: "Maximum budget", value: formatCurrency(tender.maxBudget) },
				{ label: "Deadline", value: formatDate(tender.deadline) },
			])}
			<p>The proposal document is attached (${proposal.filename}).</p>
			<p style="${EMAIL_STYLES.footer}">This is an automated message from the tender management system.</p>
		</div>
	`;

	const text = [
		`Dear ${tender.clientName},`,
		"",
		`We are formally sending you the tender: ${tender.title}`,
		"",
		productsTableText(tender.products),
		"",
		`Maximum budget: ${formatCurrency(tender.maxBudget)}`,
		`Deadline: ${formatDate(tender.deadline)}`,
		"",
		`The proposal document is attached (${proposal.filename}).`,
	].join("\n");

	const { data, error } = await resend.emails.send({
		from: env.MAIL_FROM,
		to: [tender.clientEmail],
		subject: `Tender sent: ${tender.title}`,
		html,
		text,
		attachments: [
			{
				filename: proposal.filename,
				content: arrayBufferToBase64(proposal.content),
			},
		],
	});

	if (error) {
		throw new Error(`Resend error: ${error.message}`);
	}

	return data;
}

export async function sendReminderEmail(
	env: Env,
	tender: { title: string; clientEmail: string; clientName: string; deadline: Date },
) {
	const resend = new Resend(env.RESEND_API_KEY);

	const html = `
		<div style="${EMAIL_STYLES.body}">
			<p>Dear ${tender.clientName},</p>
			<h1 style="${EMAIL_STYLES.heading}">Reminder: ${tender.title}</h1>
			<p>This is a reminder that this tender is due on <strong>${formatDate(tender.deadline)}</strong>.</p>
			<p style="${EMAIL_STYLES.footer}">This is an automated message from the tender management system.</p>
		</div>
	`;

	const text = [
		`Dear ${tender.clientName},`,
		"",
		`This is a reminder that the tender "${tender.title}" is due on ${formatDate(tender.deadline)}.`,
	].join("\n");

	const { data, error } = await resend.emails.send({
		from: env.MAIL_FROM,
		to: [tender.clientEmail],
		subject: `Reminder: tender "${tender.title}" is due soon`,
		html,
		text,
	});

	if (error) {
		throw new Error(`Resend error: ${error.message}`);
	}

	return data;
}

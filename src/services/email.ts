import { Resend } from "resend";

type TenderProductLine = { name: string; quantity: string; unitPrice: string };

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
	return new Intl.NumberFormat("es-ES", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
	}).format(Number(value));
}

function formatQuantity(value: string) {
	const n = Number(value);
	return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function formatDate(date: Date) {
	return new Intl.DateTimeFormat("es-ES", {
		dateStyle: "long",
		timeStyle: "short",
		timeZone: "UTC",
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
					<td style="${EMAIL_STYLES.tdRight}">${formatQuantity(p.quantity)}</td>
					<td style="${EMAIL_STYLES.tdRight}">${formatCurrency(p.unitPrice)}</td>
				</tr>`,
		)
		.join("");

	return `
		<table style="${EMAIL_STYLES.table}">
			<thead>
				<tr>
					<th style="${EMAIL_STYLES.th}">Producto</th>
					<th style="${EMAIL_STYLES.th}; text-align: right;">Cantidad</th>
					<th style="${EMAIL_STYLES.th}; text-align: right;">Precio unitario</th>
				</tr>
			</thead>
			<tbody>${rows}</tbody>
		</table>
	`;
}

function productsTableText(products: TenderProductLine[]) {
	return products
		.map((p) => `- ${p.name}: ${formatQuantity(p.quantity)} x ${formatCurrency(p.unitPrice)}`)
		.join("\n");
}

export async function sendTenderEmail(
	env: Env,
	tender: TenderSummary,
	proposal: { filename: string; content: ArrayBuffer; contentType: string },
) {
	const resend = new Resend(env.RESEND_API_KEY);

	const html = `
		<div style="${EMAIL_STYLES.body}">
			<p>Estimado/a ${tender.clientName},</p>
			<h1 style="${EMAIL_STYLES.heading}">Licitación: ${tender.title}</h1>
			<p>Le enviamos formalmente la siguiente licitación:</p>
			${productsTableHtml(tender.products)}
			${summaryHtml([
				{ label: "Presupuesto máximo", value: formatCurrency(tender.maxBudget) },
				{ label: "Fecha límite", value: formatDate(tender.deadline) },
			])}
			<p>Adjuntamos el documento de propuesta (${proposal.filename}).</p>
			<p style="${EMAIL_STYLES.footer}">Este es un mensaje automático del sistema de gestión de licitaciones.</p>
		</div>
	`;

	const text = [
		`Estimado/a ${tender.clientName},`,
		"",
		`Le enviamos formalmente la licitación: ${tender.title}`,
		"",
		productsTableText(tender.products),
		"",
		`Presupuesto máximo: ${formatCurrency(tender.maxBudget)}`,
		`Fecha límite: ${formatDate(tender.deadline)}`,
		"",
		`Adjuntamos el documento de propuesta (${proposal.filename}).`,
	].join("\n");

	const { data, error } = await resend.emails.send({
		from: env.MAIL_FROM,
		to: [tender.clientEmail],
		subject: `Licitación enviada: ${tender.title}`,
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
			<p>Estimado/a ${tender.clientName},</p>
			<h1 style="${EMAIL_STYLES.heading}">Recordatorio: ${tender.title}</h1>
			<p>Le recordamos que esta licitación vence el <strong>${formatDate(tender.deadline)}</strong>.</p>
			<p style="${EMAIL_STYLES.footer}">Este es un mensaje automático del sistema de gestión de licitaciones.</p>
		</div>
	`;

	const text = [
		`Estimado/a ${tender.clientName},`,
		"",
		`Le recordamos que la licitación "${tender.title}" vence el ${formatDate(tender.deadline)}.`,
	].join("\n");

	const { data, error } = await resend.emails.send({
		from: env.MAIL_FROM,
		to: [tender.clientEmail],
		subject: `Recordatorio: la licitación "${tender.title}" vence pronto`,
		html,
		text,
	});

	if (error) {
		throw new Error(`Resend error: ${error.message}`);
	}

	return data;
}

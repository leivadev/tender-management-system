// Clears clients/products/tenders/tender_products/payments/tender_status_history
// and repopulates them with mock data simulating real tenders. Does not touch `profiles`
// (Supabase Auth users) so existing logins keep working.
//
// Usage: node scripts/seed-mock.mjs --confirm
import postgres from "postgres";

const confirmed = process.argv.includes("--confirm");

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
	console.error("Missing DATABASE_URL environment variable");
	process.exit(1);
}

const host = new URL(DATABASE_URL).host;

if (!confirmed) {
	console.error(
		`This will DELETE clients/products/tenders/tender_products/payments/tender_status_history on:\n  ${host}\n\nRun again with --confirm if this is intended.`,
	);
	process.exit(1);
}

const sql = postgres(DATABASE_URL);

const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const clientsData = [
	{ name: "Marta Solano", companyName: "Andean Construction Inc.", email: "purchasing@andean.example.com" },
	{
		name: "Jorge Peralta",
		companyName: "North Hardware Group",
		email: "tenders@northhardware.example.com",
	},
	{
		name: "Luciana Vega",
		companyName: "San Rafael Regional Hospital",
		email: "procurement@sanrafael.example.com",
	},
	{
		name: "Diego Ramirez",
		companyName: "Los Alamos Municipality",
		email: "purchasing@losalamos.example.gov",
	},
	{ name: "Camila Ortiz", companyName: "TechNet Systems Ltd.", email: "suppliers@technet.example.com" },
	{
		name: "Andres Figueroa",
		companyName: "Southern Food Distributor",
		email: "purchasing@southernfood.example.com",
	},
];

const productsData = [
	{ name: "Portland cement 42.5kg", description: "Gray type I cement bag", unitPrice: "9.50" },
	{ name: 'Rebar 3/8"', description: "Steel rod 6m", unitPrice: "6.20" },
	{ name: 'Business laptop 14"', description: "Core i5, 16GB RAM, 512GB SSD", unitPrice: "780.00" },
	{ name: 'Monitor 24" FHD', description: "IPS panel, 75Hz", unitPrice: "145.00" },
	{ name: "24-port network switch", description: "Managed gigabit", unitPrice: "310.00" },
	{ name: "Hospital stretcher", description: "Folding stretcher with rails", unitPrice: "420.00" },
	{ name: "IV fluid kit (box of 50)", description: "Saline solution 1000ml", unitPrice: "95.00" },
	{ name: "Nitrile gloves (box of 100)", description: "Size M, powder-free", unitPrice: "12.00" },
	{ name: "150W LED street light", description: "Public lighting, IP65", unitPrice: "88.00" },
	{ name: "Reflective road signage", description: "60x60cm plate", unitPrice: "34.00" },
	{ name: "Long-grain rice (50kg sack)", description: "Extra quality", unitPrice: "42.00" },
	{ name: "Vegetable oil (box of 12x1L)", description: "Sunflower oil", unitPrice: "28.50" },
];

const line = (productIndex, quantity) => ({ productIndex, quantity });

// idx references clientsData / productsData by index (0-based)
const tendersData = [
	// draft (no history: creation defaults to draft)
	{
		clientIdx: 0,
		title: "Supply of materials for road works, Sector 4",
		maxBudget: "15000.00",
		deadline: daysFromNow(20),
		status: "draft",
		lines: [line(0, 800), line(1, 500)],
	},
	{
		clientIdx: 4,
		title: "Computer equipment renewal - headquarters",
		maxBudget: "20000.00",
		deadline: daysFromNow(15),
		status: "draft",
		lines: [line(2, 15), line(3, 15)],
	},
	{
		clientIdx: 3,
		title: "Public lighting upgrade, north zone",
		maxBudget: "12000.00",
		deadline: daysFromNow(25),
		status: "draft",
		lines: [line(8, 90), line(9, 60)],
	},

	// active (proposal uploaded, history draft->active)
	{
		clientIdx: 2,
		title: "Quarterly medical supplies",
		maxBudget: "18000.00",
		deadline: daysFromNow(10),
		status: "active",
		lines: [line(6, 60), line(7, 80)],
	},
	{
		clientIdx: 1,
		title: "Metal structure for warehouse",
		maxBudget: "22000.00",
		deadline: daysFromNow(18),
		status: "active",
		lines: [line(0, 1200), line(1, 900)],
	},
	{
		clientIdx: 5,
		title: "Food supply - social program",
		maxBudget: "9000.00",
		deadline: daysFromNow(12),
		status: "active",
		lines: [line(10, 120), line(11, 100)],
	},
	{
		clientIdx: 2,
		title: "Urgent restocking of biosafety supplies",
		maxBudget: "5000.00",
		deadline: daysFromNow(2),
		status: "active",
		lines: [line(7, 40)],
	},

	// finalized (proposal accepted, not yet invoiced)
	{
		clientIdx: 4,
		title: "LAN installation - new branch",
		maxBudget: "16000.00",
		deadline: daysAgo(3),
		status: "finalized",
		lines: [line(4, 20), line(3, 10)],
	},
	{
		clientIdx: 0,
		title: "Main avenue pavement repair",
		maxBudget: "25000.00",
		deadline: daysAgo(5),
		status: "finalized",
		lines: [line(0, 1500), line(1, 1000)],
	},
	{
		clientIdx: 2,
		title: "Emergency room equipment",
		maxBudget: "14000.00",
		deadline: daysAgo(2),
		status: "finalized",
		lines: [line(5, 20), line(6, 40)],
	},

	// for_collection (invoiced, awaiting payment; some partially paid)
	{
		clientIdx: 3,
		title: "Road signage, school zone",
		maxBudget: "9000.00",
		deadline: daysAgo(10),
		status: "for_collection",
		invoiceAmount: "6200.00",
		lines: [line(9, 150), line(8, 40)],
		paid: "0.00",
	},
	{
		clientIdx: 1,
		title: "Steel supply for pedestrian bridge",
		maxBudget: "30000.00",
		deadline: daysAgo(15),
		status: "for_collection",
		invoiceAmount: "24500.00",
		lines: [line(0, 1800), line(1, 1400)],
		paid: "12000.00",
	},
	{
		clientIdx: 5,
		title: "Basic food basket distribution",
		maxBudget: "7000.00",
		deadline: daysAgo(8),
		status: "for_collection",
		invoiceAmount: "5400.00",
		lines: [line(10, 90), line(11, 60)],
		paid: "3000.00",
	},

	// collected (invoiced and fully paid)
	{
		clientIdx: 4,
		title: "Workstation upgrade",
		maxBudget: "17000.00",
		deadline: daysAgo(30),
		status: "collected",
		invoiceAmount: "15600.00",
		lines: [line(2, 18), line(3, 18)],
		paid: "15600.00",
	},
	{
		clientIdx: 2,
		title: "Purchase of biosafety supplies",
		maxBudget: "10000.00",
		deadline: daysAgo(25),
		status: "collected",
		invoiceAmount: "6000.00",
		lines: [line(7, 300), line(6, 30)],
		paid: "6000.00",
	},
	{
		clientIdx: 0,
		title: "Rebar supply for foundations",
		maxBudget: "13000.00",
		deadline: daysAgo(40),
		status: "collected",
		invoiceAmount: "11200.00",
		lines: [line(1, 1500), line(0, 300)],
		paid: "11200.00",
	},

	// lost (not won / abandoned)
	{
		clientIdx: 1,
		title: "Prefabricated warehouse - industrial annex",
		maxBudget: "28000.00",
		deadline: daysAgo(6),
		status: "lost",
		lines: [line(0, 1000), line(1, 800)],
	},
	{
		clientIdx: 3,
		title: "Central park lighting",
		maxBudget: "9500.00",
		deadline: daysAgo(4),
		status: "lost",
		lines: [line(8, 70)],
	},
	{
		clientIdx: 5,
		title: "Oil supply for community kitchens",
		maxBudget: "4000.00",
		deadline: daysAgo(9),
		status: "lost",
		lines: [line(11, 80)],
	},
];

// Status history needed to reach each final status, in order.
const HISTORY_PATH = {
	draft: [],
	active: ["active"],
	finalized: ["active", "finalized"],
	for_collection: ["active", "finalized", "for_collection"],
	collected: ["active", "finalized", "for_collection", "collected"],
	lost: ["active", "lost"],
};

try {
	await sql.begin(async (tx) => {
		console.log(`Connected to ${host}. Clearing business data...`);

		await tx`delete from payments`;
		await tx`delete from tender_status_history`;
		await tx`delete from tender_products`;
		await tx`delete from tenders`;
		await tx`delete from products`;
		await tx`delete from clients`;

		const [admin] = await tx`select id from profiles where role = 'admin' order by created_at limit 1`;
		const actorId = admin?.id ?? null;

		const insertedClients = [];
		for (const c of clientsData) {
			const [row] = await tx`
				insert into clients (name, company_name, email, created_by, updated_by)
				values (${c.name}, ${c.companyName}, ${c.email}, ${actorId}, ${actorId})
				returning id
			`;
			insertedClients.push(row.id);
		}

		const insertedProducts = [];
		for (const p of productsData) {
			const [row] = await tx`
				insert into products (name, description, unit_price, created_by, updated_by)
				values (${p.name}, ${p.description}, ${p.unitPrice}, ${actorId}, ${actorId})
				returning id
			`;
			insertedProducts.push(row.id);
		}

		for (const t of tendersData) {
			const hasProposal = t.status !== "draft";
			const [tenderRow] = await tx`
				insert into tenders (
					client_id, title, description, max_budget, deadline, status,
					proposal_key, proposal_url, proposal_filename, proposal_content_type,
					invoice_amount, created_by, updated_by
				)
				values (
					${insertedClients[t.clientIdx]}, ${t.title}, ${"Tender generated as demo data."},
					${t.maxBudget}, ${t.deadline}, ${t.status},
					${hasProposal ? `proposals/${crypto.randomUUID()}.pdf` : null},
					${hasProposal ? `https://example-storage.local/proposals/${crypto.randomUUID()}.pdf` : null},
					${hasProposal ? "proposal.pdf" : null},
					${hasProposal ? "application/pdf" : null},
					${t.invoiceAmount ?? null}, ${actorId}, ${actorId}
				)
				returning id
			`;
			const tenderId = tenderRow.id;

			for (const l of t.lines) {
				const productId = insertedProducts[l.productIndex];
				const unitPrice = productsData[l.productIndex].unitPrice;
				const subtotal = (Number(unitPrice) * l.quantity).toFixed(2);
				await tx`
					insert into tender_products (tender_id, product_id, quantity, unit_price, subtotal, created_by, updated_by)
					values (${tenderId}, ${productId}, ${l.quantity}, ${unitPrice}, ${subtotal}, ${actorId}, ${actorId})
				`;
			}

			let fromStatus = null;
			for (const toStatus of HISTORY_PATH[t.status]) {
				await tx`
					insert into tender_status_history (tender_id, from_status, to_status, changed_by)
					values (${tenderId}, ${fromStatus}, ${toStatus}, ${actorId})
				`;
				fromStatus = toStatus;
			}

			if (t.status === "for_collection" && t.paid && Number(t.paid) > 0) {
				await tx`
					insert into payments (tender_id, amount, reference, notes, created_by)
					values (${tenderId}, ${t.paid}, ${"TRF-" + tenderId.slice(0, 8)}, ${"Partial payment"}, ${actorId})
				`;
			}

			if (t.status === "collected") {
				await tx`
					insert into payments (tender_id, amount, reference, notes, created_by)
					values (${tenderId}, ${t.invoiceAmount}, ${"TRF-" + tenderId.slice(0, 8)}, ${"Full payment"}, ${actorId})
				`;
			}
		}

		console.log(
			`Done: ${insertedClients.length} clients, ${insertedProducts.length} products, ${tendersData.length} tenders.`,
		);
	});
} finally {
	await sql.end();
}

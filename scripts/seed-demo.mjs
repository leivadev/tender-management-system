// Seeds ~48 realistic tenders spread over the last ~6 months (statuses, history, payments), so the
// dashboard charts and activity feed have something to show.
//
// Safe by default: it never deletes. Clients are matched by email, products by name, and tenders by
// (client, title), so running it twice does nothing the second time. Output is deterministic.
//
// Usage:
//   node scripts/seed-demo.mjs --confirm            add missing demo data (any database)
//   node scripts/seed-demo.mjs --confirm --fresh    first wipe ALL business data; localhost only
//
// DATABASE_URL must be passed explicitly. The `.env` one points to production: do not use it
// without the owner's OK.
import postgres from "postgres";

const confirmed = process.argv.includes("--confirm");
const fresh = process.argv.includes("--fresh");

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
	console.error("Missing DATABASE_URL environment variable");
	process.exit(1);
}

const url = new URL(DATABASE_URL);
const host = url.host;
const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);

if (!confirmed) {
	console.error(
		`Dry guard: this writes demo data to ${host}${fresh ? " AFTER DELETING all business data" : ""}.\nRun again with --confirm if this is intended.`,
	);
	process.exit(1);
}
if (fresh && !isLocal) {
	console.error(`Refusing --fresh on non-local host ${host}.`);
	process.exit(1);
}

// --- deterministic randomness -------------------------------------------------------------
function mulberry32(seed) {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const rand = mulberry32(20260101);
const between = (min, max) => min + rand() * (max - min);
const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const ago = (days) => new Date(now - days * DAY);
const fromNow = (days) => new Date(now + days * DAY);
const round2 = (n) => Math.round(n * 100) / 100;
const shuffle = (arr) => {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
};

// --- catalogue ----------------------------------------------------------------------------
const clientsData = [
	{ name: "Marta Solano", companyName: "Andean Construction Inc.", email: "purchasing@andean.example.com" },
	{ name: "Jorge Peralta", companyName: "North Hardware Group", email: "tenders@northhardware.example.com" },
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
	{ name: "Hospital stretcher", description: "Folding stretcher with rails", unitPrice: "1450.00" },
	{ name: "IV fluid kit (box of 50)", description: "Saline solution 1000ml", unitPrice: "95.00" },
	{ name: "Nitrile gloves (box of 100)", description: "Size M, powder-free", unitPrice: "12.00" },
	{ name: "150W LED street light", description: "Public lighting, IP65", unitPrice: "88.00" },
	{ name: "Reflective road signage", description: "60x60cm plate", unitPrice: "34.00" },
	{ name: "Long-grain rice (50kg sack)", description: "Extra quality", unitPrice: "42.00" },
	{ name: "Vegetable oil (box of 12x1L)", description: "Sunflower oil", unitPrice: "28.50" },
];

// Per client: which products it buys and 8 tender titles.
const catalog = [
	{
		products: [0, 1],
		titles: [
			"Road works materials, Sector 4",
			"Foundation package, Tower B",
			"Retaining wall reinforcement",
			"Bridge deck rebar supply",
			"Warehouse slab concrete works",
			"Drainage channel construction",
			"Housing block structural supply",
			"Highway shoulder repair",
		],
	},
	{
		products: [0, 1, 9],
		titles: [
			"Metal structure for warehouse",
			"Industrial annex framing",
			"Pedestrian bridge steel supply",
			"Distribution centre expansion",
			"Parking structure rebar",
			"Perimeter fencing and signage",
			"Cold storage shell and core",
			"Loading dock reinforcement",
		],
	},
	{
		products: [5, 6, 7],
		titles: [
			"Quarterly medical supplies",
			"Emergency room equipment",
			"Biosafety restocking, Q4",
			"Surgical ward fit-out",
			"Paediatrics unit supplies",
			"Outpatient clinic consumables",
			"ICU stretcher replacement",
			"Annual PPE framework",
		],
	},
	{
		products: [8, 9, 1],
		titles: [
			"Public lighting upgrade, north zone",
			"Central park lighting",
			"School zone road signage",
			"Ring road LED retrofit",
			"Pedestrian crossing safety kit",
			"Plaza renovation works",
			"Stormwater drain reinforcement",
			"Bus corridor signage",
		],
	},
	{
		products: [2, 3, 4],
		titles: [
			"Workstation upgrade",
			"LAN installation, new branch",
			"Headquarters laptop refresh",
			"Data centre switching renewal",
			"Training room equipment",
			"Remote office kit, Phase 2",
			"Monitor replacement programme",
			"Campus network backbone",
		],
	},
	{
		products: [10, 11],
		titles: [
			"Basic food basket distribution",
			"Community kitchens oil supply",
			"Social programme food supply",
			"School canteen staples",
			"Winter relief rice stock",
			"Hospital cafeteria supply",
			"Municipal feeding programme",
			"Emergency pantry restock",
		],
	},
];

// --- line items ---------------------------------------------------------------------------
// Which products a tender buys follows its title; quantities are rounded to purchasable lots.
const LOT = [50, 50, 5, 5, 1, 1, 10, 50, 10, 10, 10, 10]; // per product index, same order as productsData
const LINE_RULES = [
	// [title pattern, product indexes, options]
	[/rebar/i, [1]],
	[/fencing/i, [1, 9]],
	[/signage/i, [9]],
	[/lighting|\bLED\b/i, [8]],
	[/laptop|workstation|remote office/i, [2, 3], { paired: true }],
	[/monitor/i, [3], { cap: 90_000 }],
	[/training room/i, [3, 4], { cap: 30_000 }],
	[/\bLAN\b|network|switching|backbone/i, [4], { cap: 40_000 }],
	[/stretcher/i, [5], { cap: 45_000 }],
	[/PPE|consumables|supplies|restocking/i, [6, 7]],
	[/equipment|fit-out|ward/i, [5, 6], { cap: 80_000 }],
	[/\boil\b/i, [11]],
	[/rice|staples/i, [10]],
	[
		/drain|reinforcement|steel|framing|structur|slab|foundation|wall|road|highway|dock|housing|expansion|shell/i,
		[0, 1],
	],
];

function buildLines(spec) {
	const rule = LINE_RULES.find(([pattern]) => pattern.test(spec.title));
	const [, indexes, options = {}] = rule ?? [null, catalog[spec.clientIdx].products.slice(0, 2)];
	const target = Math.min(spec.targetValue, (options.cap ?? Infinity) * between(0.8, 1));
	const lot = (idx) => LOT[idx];
	const roundToLot = (idx, qty) => Math.max(lot(idx), Math.round(qty / lot(idx)) * lot(idx));

	if (options.paired) {
		// One monitor per laptop: quantity set by the combined unit price.
		const unitSum = indexes.reduce((sum, idx) => sum + Number(productsData[idx].unitPrice), 0);
		const qty = roundToLot(indexes[0], target / unitSum);
		return indexes.map((productIdx) => ({ productIdx, quantity: qty }));
	}
	const weights = indexes.map(() => between(0.6, 1.4));
	const weightSum = weights.reduce((a, b) => a + b, 0);
	return indexes.map((productIdx, i) => ({
		productIdx,
		quantity: roundToLot(
			productIdx,
			(target * weights[i]) / weightSum / Number(productsData[productIdx].unitPrice),
		),
	}));
}

// --- tender specs -------------------------------------------------------------------------
const STATUS_MIX = [
	...Array(5).fill("draft"),
	...Array(9).fill("active"),
	...Array(5).fill("finalized"),
	...Array(8).fill("for_collection"),
	...Array(15).fill("collected"),
	...Array(6).fill("lost"),
];
const statuses = shuffle(STATUS_MIX);
const urgentSlots = [0.4, 1.6]; // two active tenders due within 72h (one within 24h)

// Tenders that reached `finalized` ("won") are spread evenly over the six calendar months the dashboard
// charts (current one first), so the won series reads as steady growth instead of random lumps.
const WON_PER_MONTH = [4, 9, 4, 4, 4, 3]; // index = months back; sums to 28 = 5 + 8 + 15 won tenders
const WON_VALUE_PER_MONTH = [640_000, 620_000, 600_000, 560_000, 540_000, 500_000];
const monthBounds = (monthsBack) => {
	const d = new Date(now);
	const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - monthsBack, 1);
	const end = Math.min(now, Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - monthsBack + 1, 1));
	return [(now - end) / DAY, (now - start) / DAY]; // days ago: [most recent, oldest]
};
const monthsBackOf = (daysAgo) => {
	const t = new Date(now - daysAgo * DAY);
	const d = new Date(now);
	return (d.getUTCFullYear() - t.getUTCFullYear()) * 12 + d.getUTCMonth() - t.getUTCMonth();
};
const wonSlots = WON_PER_MONTH.flatMap((count, monthsBack) => {
	const [lo, hi] = monthBounds(monthsBack);
	return Array.from({ length: count }, (_, i) => lo + ((i + rand()) * (hi - lo)) / count);
}).sort((x, y) => x - y);
// Most recent wins are still `finalized`, then `for_collection`, the oldest are `collected`.
const slotQueues = {
	finalized: wonSlots.slice(0, 5),
	for_collection: wonSlots.slice(5, 13),
	collected: wonSlots.slice(13),
};

function buildSpec(clientIdx, titleIdx, status) {
	const cat = catalog[clientIdx];
	const title = cat.titles[titleIdx];
	const spec = { clientIdx, title, status, history: [], payments: [] };

	// All values below are "days ago" (decreasing along the timeline) unless noted.
	let createdAgo;
	switch (status) {
		case "draft": {
			createdAgo = between(0.2, 10);
			spec.deadline = fromNow(between(12, 40));
			break;
		}
		case "active": {
			const activeAgo = between(0.5, 10);
			createdAgo = activeAgo + between(0.5, 3);
			spec.history.push(["active", activeAgo]);
			spec.deadline = urgentSlots.length ? fromNow(urgentSlots.shift()) : fromNow(between(4, 45));
			break;
		}
		case "finalized": {
			const finalizedAgo = slotQueues.finalized.shift();
			const activeAgo = finalizedAgo + between(5, 14);
			createdAgo = activeAgo + between(1, 4);
			spec.history.push(["active", activeAgo], ["finalized", finalizedAgo]);
			spec.deadline = ago(finalizedAgo - between(1, 10));
			spec.finalizedAgo = finalizedAgo;
			break;
		}
		case "for_collection": {
			const finalizedAgo = Math.min(Math.max(slotQueues.for_collection.shift(), 5), 33); // little is overdue
			const invoicedAgo = finalizedAgo - between(1, 4);
			const activeAgo = finalizedAgo + between(5, 18);
			createdAgo = activeAgo + between(1, 4);
			spec.history.push(["active", activeAgo], ["finalized", finalizedAgo], ["for_collection", invoicedAgo]);
			spec.deadline = ago(finalizedAgo - between(1, 10));
			spec.invoicedAgo = invoicedAgo;
			spec.finalizedAgo = finalizedAgo;
			break;
		}
		case "collected": {
			const finalizedAgo = Math.max(slotQueues.collected.shift(), 22);
			const invoicedAgo = finalizedAgo - between(1, 5);
			const settledAgo = Math.max(0.5, invoicedAgo - between(10, 70));
			const activeAgo = finalizedAgo + between(5, 18);
			createdAgo = activeAgo + between(1, 4);
			spec.history.push(
				["active", activeAgo],
				["finalized", finalizedAgo],
				["for_collection", invoicedAgo],
				["collected", settledAgo],
			);
			spec.deadline = ago(finalizedAgo - between(1, 10));
			spec.invoicedAgo = invoicedAgo;
			spec.settledAgo = settledAgo;
			spec.finalizedAgo = finalizedAgo;
			break;
		}
		case "lost": {
			const activeAgo = between(8, 150);
			const lostAgo = activeAgo - between(4, Math.min(20, activeAgo - 1));
			createdAgo = activeAgo + between(1, 4);
			spec.history.push(["active", activeAgo], ["lost", lostAgo]);
			spec.byCron = rand() < 0.65;
			spec.deadline = spec.byCron ? ago(lostAgo) : fromNow(between(1, 20));
			break;
		}
	}
	spec.createdAgo = createdAgo;

	// Target value per tender; quantities are derived from it in seed time.
	spec.targetValue = between(25_000, 300_000);
	spec.budgetPadding = between(1.05, 1.35);
	spec.paymentSplit = rand();
	spec.partialShare = between(0.25, 0.7);
	return spec;
}

const specs = [];
for (let c = 0; c < clientsData.length; c++) {
	for (let t = 0; t < 8; t++) specs.push(buildSpec(c, t, statuses[c * 8 + t]));
}

// Split each month's target value among the tenders won that month.
const wonByMonth = new Map();
for (const spec of specs) {
	if (spec.finalizedAgo === undefined) continue;
	const key = monthsBackOf(spec.finalizedAgo);
	wonByMonth.set(key, [...(wonByMonth.get(key) ?? []), spec]);
}
for (const [monthsBack, group] of wonByMonth) {
	const weights = group.map(() => between(0.6, 1.6));
	const total = weights.reduce((a, b) => a + b, 0);
	const target = WON_VALUE_PER_MONTH[monthsBack] ?? 500_000;
	group.forEach((spec, i) => {
		spec.targetValue = (target * weights[i]) / total;
	});
}

// --- database -----------------------------------------------------------------------------
const sql = postgres(DATABASE_URL);

try {
	await sql.begin(async (tx) => {
		console.log(`Connected to ${host}.`);

		if (fresh) {
			console.log("--fresh: clearing business data (local database only)...");
			await tx`delete from payments`;
			await tx`delete from tender_status_history`;
			await tx`delete from tender_products`;
			await tx`delete from tenders`;
			await tx`delete from products`;
			await tx`delete from clients`;
		}

		const [admin] = await tx`select id from profiles where role = 'admin' order by created_at limit 1`;
		const actorId = admin?.id ?? null;

		const clientIds = [];
		for (const c of clientsData) {
			const [existing] = await tx`select id from clients where email = ${c.email} limit 1`;
			if (existing) {
				clientIds.push(existing.id);
				continue;
			}
			const [row] = await tx`
				insert into clients (name, company_name, email, created_by, updated_by)
				values (${c.name}, ${c.companyName}, ${c.email}, ${actorId}, ${actorId})
				returning id
			`;
			clientIds.push(row.id);
		}

		const productRows = [];
		for (const p of productsData) {
			const [existing] = await tx`select id, unit_price from products where name = ${p.name} limit 1`;
			if (existing) {
				productRows.push({ id: existing.id, unitPrice: Number(existing.unit_price) });
				continue;
			}
			const [row] = await tx`
				insert into products (name, description, unit_price, created_by, updated_by)
				values (${p.name}, ${p.description}, ${p.unitPrice}, ${actorId}, ${actorId})
				returning id
			`;
			productRows.push({ id: row.id, unitPrice: Number(p.unitPrice) });
		}

		let created = 0;
		let skipped = 0;
		for (const spec of specs) {
			const clientId = clientIds[spec.clientIdx];
			const [dup] =
				await tx`select 1 as x from tenders where client_id = ${clientId} and title = ${spec.title} limit 1`;
			if (dup) {
				skipped++;
				continue;
			}

			const lines = buildLines(spec).map(({ productIdx, quantity }) => {
				const { unitPrice, id } = productRows[productIdx];
				return { productId: id, quantity, unitPrice, subtotal: round2(quantity * unitPrice) };
			});
			const total = round2(lines.reduce((s, l) => s + l.subtotal, 0));
			const budgetStep = total >= 50_000 ? 5000 : 1000;
			const maxBudget = Math.ceil((total * spec.budgetPadding) / budgetStep) * budgetStep;
			const invoiceAmount = spec.status === "for_collection" || spec.status === "collected" ? total : null;
			const hasProposal = spec.status !== "draft";
			const lastEventAgo = spec.history.length
				? Math.min(...spec.history.map(([, d]) => d))
				: spec.createdAgo;

			const [tenderRow] = await tx`
				insert into tenders (
					client_id, title, description, max_budget, deadline, status,
					proposal_key, proposal_url, proposal_filename, proposal_content_type,
					invoice_amount, created_at, updated_at, created_by, updated_by
				)
				values (
					${clientId}, ${spec.title}, ${"Tender generated as demo data."},
					${maxBudget}, ${spec.deadline}, ${spec.status},
					${hasProposal ? `proposals/${crypto.randomUUID()}.pdf` : null},
					${hasProposal ? `https://example-storage.local/proposals/${crypto.randomUUID()}.pdf` : null},
					${hasProposal ? "proposal.pdf" : null},
					${hasProposal ? "application/pdf" : null},
					${invoiceAmount}, ${ago(spec.createdAgo)}, ${ago(lastEventAgo)}, ${actorId}, ${actorId}
				)
				returning id
			`;
			const tenderId = tenderRow.id;

			for (const l of lines) {
				await tx`
					insert into tender_products (tender_id, product_id, quantity, unit_price, subtotal, created_at, updated_at, created_by, updated_by)
					values (${tenderId}, ${l.productId}, ${l.quantity}, ${l.unitPrice}, ${l.subtotal}, ${ago(spec.createdAgo)}, ${ago(spec.createdAgo)}, ${actorId}, ${actorId})
				`;
			}

			let fromStatus = null;
			for (const [toStatus, daysAgo] of spec.history) {
				const changedBy = toStatus === "lost" && spec.byCron ? null : actorId;
				await tx`
					insert into tender_status_history (tender_id, from_status, to_status, changed_by, changed_at)
					values (${tenderId}, ${fromStatus}, ${toStatus}, ${changedBy}, ${ago(daysAgo)})
				`;
				fromStatus = toStatus;
			}

			// Payments, strictly between invoicing and now (or settlement).
			const payments = [];
			if (spec.status === "for_collection" && spec.paymentSplit > 0.4) {
				const amount = round2(Math.round((total * spec.partialShare) / 100) * 100);
				if (amount > 0 && amount < total) {
					payments.push({
						amount,
						daysAgo: Math.max(0.2, spec.invoicedAgo - between(1, Math.max(1.5, spec.invoicedAgo - 0.5))),
					});
				}
			}
			if (spec.status === "collected") {
				const span = spec.invoicedAgo - spec.settledAgo;
				if (spec.paymentSplit < 0.45) {
					payments.push({ amount: total, daysAgo: spec.settledAgo });
				} else {
					const first = round2(Math.round((total * spec.partialShare) / 100) * 100);
					const firstAgo = spec.settledAgo + span * between(0.3, 0.7);
					if (first > 0 && first < total) {
						payments.push(
							{ amount: first, daysAgo: firstAgo },
							{ amount: round2(total - first), daysAgo: spec.settledAgo },
						);
					} else {
						payments.push({ amount: total, daysAgo: spec.settledAgo });
					}
				}
			}
			for (const [i, p] of payments.entries()) {
				const isLast = i === payments.length - 1;
				await tx`
					insert into payments (tender_id, amount, paid_at, reference, notes, created_at, created_by)
					values (
						${tenderId}, ${p.amount}, ${ago(p.daysAgo)},
						${`TRF-${tenderId.slice(0, 8)}${payments.length > 1 ? `-${i + 1}` : ""}`},
						${spec.status === "collected" && isLast ? "Final payment" : "Partial payment"},
						${ago(p.daysAgo)}, ${actorId}
					)
				`;
			}
			created++;
		}

		console.log(
			`Done: ${created} tenders created, ${skipped} already present. (${clientIds.length} clients, ${productRows.length} products ensured.)`,
		);
	});
} finally {
	await sql.end();
}

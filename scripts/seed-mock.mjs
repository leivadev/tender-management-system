// Limpia clients/products/tenders/tender_products/payments/tender_status_history
// y los repuebla con datos mock que simulan licitaciones reales. No toca `profiles`
// (usuarios de Supabase Auth) para no romper logins existentes.
//
// Uso: node scripts/seed-mock.mjs --confirm
import postgres from "postgres";

const confirmed = process.argv.includes("--confirm");

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
	console.error("Falta la variable de entorno DATABASE_URL");
	process.exit(1);
}

const host = new URL(DATABASE_URL).host;

if (!confirmed) {
	console.error(
		`Esto va a BORRAR clients/products/tenders/tender_products/payments/tender_status_history en:\n  ${host}\n\nCorre de nuevo con --confirm si es intencional.`,
	);
	process.exit(1);
}

const sql = postgres(DATABASE_URL);

const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const clientsData = [
	{ name: "Marta Solano", companyName: "Constructora Andina S.A.", email: "compras@andina.example.com" },
	{
		name: "Jorge Peralta",
		companyName: "Grupo Ferretero del Norte",
		email: "licitaciones@ferreteronorte.example.com",
	},
	{
		name: "Luciana Vega",
		companyName: "Hospital Regional San Rafael",
		email: "adquisiciones@sanrafael.example.com",
	},
	{
		name: "Diego Ramírez",
		companyName: "Municipalidad de Los Álamos",
		email: "compras@losalamos.example.gob",
	},
	{ name: "Camila Ortiz", companyName: "TecnoRed Sistemas Ltda.", email: "proveedores@tecnored.example.com" },
	{
		name: "Andrés Figueroa",
		companyName: "Distribuidora Alimentaria Sur",
		email: "compras@alimentariasur.example.com",
	},
];

const productsData = [
	{ name: "Cemento Portland 42.5kg", description: "Bolsa de cemento gris tipo I", unitPrice: "9.50" },
	{ name: 'Varilla corrugada 3/8"', description: "Varilla de acero 6m", unitPrice: "6.20" },
	{ name: 'Laptop empresarial 14"', description: "Core i5, 16GB RAM, 512GB SSD", unitPrice: "780.00" },
	{ name: 'Monitor 24" FHD', description: "Panel IPS, 75Hz", unitPrice: "145.00" },
	{ name: "Switch de red 24 puertos", description: "Gigabit administrable", unitPrice: "310.00" },
	{ name: "Camilla hospitalaria", description: "Camilla plegable con barandales", unitPrice: "420.00" },
	{ name: "Kit de sueros IV (caja 50u)", description: "Solución salina 1000ml", unitPrice: "95.00" },
	{ name: "Guantes de nitrilo (caja 100u)", description: "Talla M, sin polvo", unitPrice: "12.00" },
	{ name: "Luminaria LED vial 150W", description: "Alumbrado público, IP65", unitPrice: "88.00" },
	{ name: "Señalética vial reflectiva", description: "Placa 60x60cm", unitPrice: "34.00" },
	{ name: "Arroz grano largo (saco 50kg)", description: "Calidad extra", unitPrice: "42.00" },
	{ name: "Aceite vegetal (caja 12x1L)", description: "Aceite de girasol", unitPrice: "28.50" },
];

const line = (productIndex, quantity) => ({ productIndex, quantity });

// idx referencia clientsData / productsData por índice (0-based)
const tendersData = [
	// draft (sin historial: el default de creación es draft)
	{
		clientIdx: 0,
		title: "Suministro de materiales para obra vial Sector 4",
		maxBudget: "15000.00",
		deadline: daysFromNow(20),
		status: "draft",
		lines: [line(0, 800), line(1, 500)],
	},
	{
		clientIdx: 4,
		title: "Renovación de equipos de cómputo - sede central",
		maxBudget: "20000.00",
		deadline: daysFromNow(15),
		status: "draft",
		lines: [line(2, 15), line(3, 15)],
	},
	{
		clientIdx: 3,
		title: "Modernización de alumbrado público zona norte",
		maxBudget: "12000.00",
		deadline: daysFromNow(25),
		status: "draft",
		lines: [line(8, 90), line(9, 60)],
	},

	// active (con propuesta cargada, historial draft->active)
	{
		clientIdx: 2,
		title: "Suministro de insumos médicos trimestral",
		maxBudget: "18000.00",
		deadline: daysFromNow(10),
		status: "active",
		lines: [line(6, 60), line(7, 80)],
	},
	{
		clientIdx: 1,
		title: "Provisión de estructura metálica para bodega",
		maxBudget: "22000.00",
		deadline: daysFromNow(18),
		status: "active",
		lines: [line(0, 1200), line(1, 900)],
	},
	{
		clientIdx: 5,
		title: "Abastecimiento de alimentos - programa social",
		maxBudget: "9000.00",
		deadline: daysFromNow(12),
		status: "active",
		lines: [line(10, 120), line(11, 100)],
	},
	{
		clientIdx: 2,
		title: "Reposición urgente de insumos de bioseguridad",
		maxBudget: "5000.00",
		deadline: daysFromNow(2),
		status: "active",
		lines: [line(7, 40)],
	},

	// finalized (propuesta aceptada, aún no facturada)
	{
		clientIdx: 4,
		title: "Instalación de red LAN - nueva sucursal",
		maxBudget: "16000.00",
		deadline: daysAgo(3),
		status: "finalized",
		lines: [line(4, 20), line(3, 10)],
	},
	{
		clientIdx: 0,
		title: "Reparación de pavimento avenida principal",
		maxBudget: "25000.00",
		deadline: daysAgo(5),
		status: "finalized",
		lines: [line(0, 1500), line(1, 1000)],
	},
	{
		clientIdx: 2,
		title: "Equipamiento de sala de emergencias",
		maxBudget: "14000.00",
		deadline: daysAgo(2),
		status: "finalized",
		lines: [line(5, 20), line(6, 40)],
	},

	// for_collection (facturada, pendiente de cobro; algunas con pago parcial)
	{
		clientIdx: 3,
		title: "Señalización vial zona escolar",
		maxBudget: "9000.00",
		deadline: daysAgo(10),
		status: "for_collection",
		invoiceAmount: "6200.00",
		lines: [line(9, 150), line(8, 40)],
		paid: "0.00",
	},
	{
		clientIdx: 1,
		title: "Suministro de acero para puente peatonal",
		maxBudget: "30000.00",
		deadline: daysAgo(15),
		status: "for_collection",
		invoiceAmount: "24500.00",
		lines: [line(0, 1800), line(1, 1400)],
		paid: "12000.00",
	},
	{
		clientIdx: 5,
		title: "Distribución de canastas básicas",
		maxBudget: "7000.00",
		deadline: daysAgo(8),
		status: "for_collection",
		invoiceAmount: "5400.00",
		lines: [line(10, 90), line(11, 60)],
		paid: "3000.00",
	},

	// collected (facturada y cobrada por completo)
	{
		clientIdx: 4,
		title: "Actualización de estaciones de trabajo",
		maxBudget: "17000.00",
		deadline: daysAgo(30),
		status: "collected",
		invoiceAmount: "15600.00",
		lines: [line(2, 18), line(3, 18)],
		paid: "15600.00",
	},
	{
		clientIdx: 2,
		title: "Compra de insumos de bioseguridad",
		maxBudget: "10000.00",
		deadline: daysAgo(25),
		status: "collected",
		invoiceAmount: "6000.00",
		lines: [line(7, 300), line(6, 30)],
		paid: "6000.00",
	},
	{
		clientIdx: 0,
		title: "Suministro de varilla para cimentación",
		maxBudget: "13000.00",
		deadline: daysAgo(40),
		status: "collected",
		invoiceAmount: "11200.00",
		lines: [line(1, 1500), line(0, 300)],
		paid: "11200.00",
	},

	// lost (no ganada / abandonada)
	{
		clientIdx: 1,
		title: "Bodega prefabricada - anexo industrial",
		maxBudget: "28000.00",
		deadline: daysAgo(6),
		status: "lost",
		lines: [line(0, 1000), line(1, 800)],
	},
	{
		clientIdx: 3,
		title: "Iluminación de parque central",
		maxBudget: "9500.00",
		deadline: daysAgo(4),
		status: "lost",
		lines: [line(8, 70)],
	},
	{
		clientIdx: 5,
		title: "Provisión de aceite para comedores comunitarios",
		maxBudget: "4000.00",
		deadline: daysAgo(9),
		status: "lost",
		lines: [line(11, 80)],
	},
];

// Historial de estados necesario para llegar a cada status final, en orden.
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
		console.log(`Conectado a ${host}. Limpiando datos de negocio...`);

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
					${insertedClients[t.clientIdx]}, ${t.title}, ${"Licitación generada como dato de demostración."},
					${t.maxBudget}, ${t.deadline}, ${t.status},
					${hasProposal ? `proposals/${crypto.randomUUID()}.pdf` : null},
					${hasProposal ? `https://example-storage.local/proposals/${crypto.randomUUID()}.pdf` : null},
					${hasProposal ? "propuesta.pdf" : null},
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
					values (${tenderId}, ${t.paid}, ${"TRF-" + tenderId.slice(0, 8)}, ${"Abono parcial"}, ${actorId})
				`;
			}

			if (t.status === "collected") {
				await tx`
					insert into payments (tender_id, amount, reference, notes, created_by)
					values (${tenderId}, ${t.invoiceAmount}, ${"TRF-" + tenderId.slice(0, 8)}, ${"Pago total"}, ${actorId})
				`;
			}
		}

		console.log(
			`Listo: ${insertedClients.length} clientes, ${insertedProducts.length} productos, ${tendersData.length} licitaciones.`,
		);
	});
} finally {
	await sql.end();
}

import type { TenderStatus } from "../api/types";

export const KPIS = [
	{
		label: "Open pipeline",
		value: 2_840_000,
		delta: "+12.4%",
		up: true,
		note: "18 active tenders",
		icon: "pipeline",
		tone: "positive",
	},
	{
		label: "Won this month",
		value: 612_500,
		delta: "+8.1%",
		up: true,
		note: "vs. $566k last month",
		icon: "won",
		tone: "positive",
	},
	{
		label: "Outstanding",
		value: 418_200,
		delta: "-3.2%",
		up: false,
		note: "9 invoices awaiting payment",
		icon: "outstanding",
		tone: "warning",
	},
	{
		label: "Overdue",
		value: 3,
		delta: "+1",
		up: false,
		note: "Past deadline, still active",
		icon: "overdue",
		tone: "negative",
	},
] as const;

export const MONTHLY = [
	{ month: "May", won: 380, collected: 310 },
	{ month: "Jun", won: 450, collected: 390 },
	{ month: "Jul", won: 410, collected: 405 },
	{ month: "Aug", won: 530, collected: 440 },
	{ month: "Sep", won: 566, collected: 480 },
	{ month: "Oct", won: 612, collected: 455 },
];

export const PIPELINE: { status: TenderStatus; count: number; value: number }[] = [
	{ status: "draft", count: 9, value: 640 },
	{ status: "active", count: 18, value: 2840 },
	{ status: "finalized", count: 7, value: 1120 },
	{ status: "for_collection", count: 9, value: 418 },
	{ status: "collected", count: 21, value: 3960 },
	{ status: "lost", count: 6, value: 590 },
];

export const DUE_SOON = [
	{
		id: "TND-1042",
		title: "Metro Line 4 signalling spares",
		client: "Transit Authority",
		status: "active" as TenderStatus,
		budget: 184_000,
		due: "In 6h",
		urgent: true,
	},
	{
		id: "TND-1038",
		title: "Regional hospital imaging supply",
		client: "Northwind Health",
		status: "finalized" as TenderStatus,
		budget: 480_000,
		due: "In 1d",
		urgent: true,
	},
	{
		id: "TND-1051",
		title: "University lab equipment renewal",
		client: "Halden University",
		status: "active" as TenderStatus,
		budget: 96_500,
		due: "In 2d",
		urgent: false,
	},
	{
		id: "TND-1047",
		title: "Municipal fleet tyres, 2027 contract",
		client: "City of Aldermoor",
		status: "draft" as TenderStatus,
		budget: 72_800,
		due: "In 2d",
		urgent: false,
	},
	{
		id: "TND-1035",
		title: "Port authority crane maintenance",
		client: "Baltic Harbour Co.",
		status: "for_collection" as TenderStatus,
		budget: 310_000,
		due: "In 3d",
		urgent: false,
	},
	{
		id: "TND-1029",
		title: "School district IT refresh",
		client: "Eastfield USD",
		status: "active" as TenderStatus,
		budget: 128_400,
		due: "In 3d",
		urgent: false,
	},
];

export const ACTIVITY = [
	{ who: "Maya Okafor", what: "recorded a payment of $120,000 on", target: "TND-1038", when: "12m ago" },
	{ who: "Daniel Reyes", what: "finalized", target: "TND-1035", when: "1h ago" },
	{ who: "System", what: "sent expiry reminder for", target: "TND-1042", when: "3h ago" },
	{ who: "Maya Okafor", what: "uploaded a proposal to", target: "TND-1051", when: "5h ago" },
	{ who: "Priya Nair", what: "marked as lost", target: "TND-1019", when: "Yesterday" },
];

export const DETAIL = {
	id: "TND-1038",
	title: "Regional hospital imaging supply",
	client: "Northwind Health",
	owner: "Maya Okafor",
	status: "for_collection" as TenderStatus,
	budget: 480_000,
	invoiced: 480_000,
	paid: 270_000,
	deadline: "Oct 12, 2026",
	created: "Aug 21, 2026",
	steps: [
		{ status: "draft" as TenderStatus, date: "Aug 21" },
		{ status: "active" as TenderStatus, date: "Aug 28" },
		{ status: "finalized" as TenderStatus, date: "Sep 30" },
		{ status: "for_collection" as TenderStatus, date: "Oct 02" },
		{ status: "collected" as TenderStatus, date: null },
	],
	lines: [
		{ name: "MRI coil set, 3T", qty: 4, unit: 38_500 },
		{ name: "Digital X-ray detector panel", qty: 6, unit: 24_200 },
		{ name: "Ultrasound probe, cardiac", qty: 10, unit: 9_800 },
		{ name: "Installation & calibration", qty: 1, unit: 82_800 },
	],
	payments: [
		{ date: "Oct 02", ref: "Wire · NH-88213", amount: 150_000 },
		{ date: "Oct 06", ref: "Wire · NH-88540", amount: 120_000 },
	],
	history: [
		{
			title: "Payment recorded",
			detail: "$120,000 · Wire NH-88540",
			who: "Maya Okafor",
			when: "Oct 06, 14:20",
			tone: "positive" as const,
		},
		{
			title: "Payment recorded",
			detail: "$150,000 · Wire NH-88213",
			who: "Maya Okafor",
			when: "Oct 02, 09:41",
			tone: "positive" as const,
		},
		{
			title: "Invoiced",
			detail: "Amount $480,000",
			who: "Daniel Reyes",
			when: "Oct 02, 09:30",
			tone: "warning" as const,
		},
		{
			title: "Finalized",
			detail: "Proposal accepted",
			who: "Daniel Reyes",
			when: "Sep 30, 16:05",
			tone: "accent" as const,
		},
		{
			title: "Sent to client",
			detail: "Draft → Active",
			who: "Maya Okafor",
			when: "Aug 28, 11:12",
			tone: "info" as const,
		},
		{
			title: "Created",
			detail: "Draft",
			who: "Maya Okafor",
			when: "Aug 21, 10:02",
			tone: "neutral" as const,
		},
	],
};

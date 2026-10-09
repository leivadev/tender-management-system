export type Role = "admin" | "user" | "viewer";

export type TenderStatus = "draft" | "active" | "finalized" | "for_collection" | "collected" | "lost";

export const TENDER_STATUSES: TenderStatus[] = [
	"draft",
	"active",
	"finalized",
	"for_collection",
	"collected",
	"lost",
];

export interface Page<T> {
	data: T[];
	page: number;
	pageSize: number;
	total: number;
}

// --- auth ---

export interface LoginRequest {
	email: string;
	password: string;
}

export interface LoginResponse {
	success: true;
	access_token: string;
	expires_at?: number;
}

export interface User {
	id: string;
	email: string;
	role: Role;
}

// --- users ---

export interface CreateUserRequest {
	email: string;
	password: string;
	role?: Role;
}

export interface UpdateUserRequest {
	role: Role;
}

// --- clients ---

export interface Client {
	id: string;
	name: string;
	companyName: string;
	email: string;
	createdAt: string;
	updatedAt: string;
}

export interface CreateClientRequest {
	name: string;
	companyName: string;
	email: string;
}

export type UpdateClientRequest = Partial<CreateClientRequest>;

// --- products ---

export interface Product {
	id: string;
	name: string;
	description: string | null;
	unitPrice: string;
	active: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface CreateProductRequest {
	name: string;
	description?: string;
	unitPrice: number;
}

export type UpdateProductRequest = Partial<CreateProductRequest> & { active?: boolean };

// --- dashboard ---

export interface DashboardSummary {
	success: true;
	counts: Record<TenderStatus, number>;
	total: number;
	upcoming: Array<{
		id: string;
		title: string;
		deadline: string;
		maxBudget: string;
		clientName: string;
	}>;
}

// --- tenders ---

export interface Tender {
	id: string;
	clientId: string;
	title: string;
	description: string | null;
	maxBudget: string;
	deadline: string;
	status: TenderStatus;
	proposalKey: string | null;
	proposalUrl: string | null;
	proposalFilename: string | null;
	proposalContentType: string | null;
	invoiceAmount: string | null;
	reminderSentAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface TenderListItem extends Tender {
	clientName: string | null;
}

export interface TenderProductLine {
	id: string;
	productId: string;
	productName: string;
	quantity: string;
	unitPrice: string;
	subtotal: string;
}

export interface TenderStatusHistoryRow {
	id: string;
	tenderId: string;
	fromStatus: TenderStatus | null;
	toStatus: TenderStatus;
	changedBy: string | null;
	changedAt: string;
}

export interface TenderDetail extends Tender {
	products: TenderProductLine[];
	history: TenderStatusHistoryRow[];
}

export interface CreateTenderRequest {
	clientId: string;
	title: string;
	description?: string;
	maxBudget: number;
	deadline: string;
}

/** Intentionally limited to informational fields — see src/endpoints/tenders/tenderUpdate.ts. */
export interface UpdateTenderRequest {
	title?: string;
	description?: string;
}

export interface AddTenderProductRequest {
	productId: string;
	quantity: number;
}

export interface InvoiceTenderRequest {
	invoiceAmount: number;
}

export interface Payment {
	id: string;
	tenderId: string;
	amount: string;
	paidAt: string;
	reference: string | null;
	notes: string | null;
	createdAt: string;
}

export interface CreatePaymentRequest {
	amount: number;
	reference?: string;
	notes?: string;
}

export interface CreatePaymentResponse {
	success: true;
	payment: Payment;
	pendingBalance: number;
}

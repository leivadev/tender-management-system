import { Package, Plus, SearchX } from "lucide-react";
import { useState } from "react";
import { fieldErrors } from "../api/errors";
import type { Product } from "../api/types";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card, CardHeader } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { ErrorMessage } from "../components/ErrorMessage";
import { Field, FieldButtonSlot, InlineFieldError } from "../components/Field";
import { PageHeader } from "../components/PageHeader";
import { Pagination } from "../components/Pagination";
import { SearchInput } from "../components/SearchInput";
import { TableSkeleton } from "../components/Skeleton";
import { Table, TBody, TD, TH, THead, TR } from "../components/Table";
import { useListParams } from "../hooks/useListParams";
import { useCreateProduct, useProducts, useUpdateProduct } from "../hooks/useProducts";
import { useAuth } from "../lib/AuthContext";
import { formatCurrency } from "../lib/format";
import { fieldClass } from "../lib/formStyles";
import { pushToast } from "../lib/toast";

function ProductRow({ product, onEdit }: { product: Product; onEdit: () => void }) {
	const { isAdmin } = useAuth();
	return (
		<TR>
			<TD className="font-medium">{product.name}</TD>
			<TD className="max-w-xs truncate text-muted-foreground">{product.description || "—"}</TD>
			<TD numeric>{formatCurrency(product.unitPrice)}</TD>
			{isAdmin && (
				<TD>
					<Badge tone={product.active ? "positive" : "neutral"}>
						{product.active ? "Active" : "Inactive"}
					</Badge>
				</TD>
			)}
			<TD className="text-right">
				{isAdmin && (
					<Button variant="ghost" onClick={onEdit}>
						Edit
					</Button>
				)}
			</TD>
		</TR>
	);
}

function ProductEditRow({ product, onDone }: { product: Product; onDone: () => void }) {
	const updateProduct = useUpdateProduct();
	const [name, setName] = useState(product.name);
	const [description, setDescription] = useState(product.description ?? "");
	const [unitPrice, setUnitPrice] = useState(product.unitPrice);
	const [active, setActive] = useState(product.active);
	const errs = fieldErrors(updateProduct.error);

	function handleSave() {
		updateProduct.mutate(
			{
				id: product.id,
				payload: {
					name: name.trim(),
					description: description.trim() || undefined,
					unitPrice: Number(unitPrice),
					active,
				},
			},
			{
				onSuccess: () => {
					pushToast("Product updated.");
					onDone();
				},
			},
		);
	}

	return (
		<TR className="h-14 bg-primary-soft/40">
			<TD>
				<input
					aria-label="Name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					className={fieldClass(Boolean(errs.name))}
					aria-invalid={Boolean(errs.name)}
					aria-describedby={errs.name ? "edit-name-error" : undefined}
					minLength={2}
					required
				/>
				<InlineFieldError id="edit-name-error" message={errs.name} />
			</TD>
			<TD>
				<input
					aria-label="Description"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					className={fieldClass(Boolean(errs.description))}
					aria-invalid={Boolean(errs.description)}
					aria-describedby={errs.description ? "edit-description-error" : undefined}
				/>
				<InlineFieldError id="edit-description-error" message={errs.description} />
			</TD>
			<TD numeric>
				<input
					aria-label="Unit price"
					type="number"
					min="0.01"
					step="0.01"
					value={unitPrice}
					onChange={(e) => setUnitPrice(e.target.value)}
					className={`ml-auto w-28 ${fieldClass(Boolean(errs.unitPrice))}`}
					aria-invalid={Boolean(errs.unitPrice)}
					aria-describedby={errs.unitPrice ? "edit-price-error" : undefined}
					required
				/>
				<InlineFieldError id="edit-price-error" message={errs.unitPrice} />
			</TD>
			<TD>
				<label className="flex items-center gap-2">
					<input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
					Active
				</label>
			</TD>
			<TD>
				<div className="flex justify-end gap-2">
					<Button variant="secondary" onClick={onDone}>
						Cancel
					</Button>
					<Button loading={updateProduct.isPending} onClick={handleSave}>
						Save
					</Button>
				</div>
			</TD>
		</TR>
	);
}

function CreateProductForm({ onDone }: { onDone: () => void }) {
	const createProduct = useCreateProduct();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [unitPrice, setUnitPrice] = useState("");
	const errs = fieldErrors(createProduct.error);

	function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
		e.preventDefault();
		createProduct.mutate(
			{ name: name.trim(), description: description.trim() || undefined, unitPrice: Number(unitPrice) },
			{
				onSuccess: () => {
					pushToast("Product created.");
					onDone();
				},
			},
		);
	}

	return (
		<Card className="mb-4">
			<CardHeader title="New product" />
			<form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 p-4">
				<Field label="Name" htmlFor="name" error={errs.name}>
					<input
						id="name"
						required
						minLength={2}
						value={name}
						onChange={(e) => setName(e.target.value)}
						className={fieldClass(Boolean(errs.name))}
					/>
				</Field>
				<Field label="Description" htmlFor="description" error={errs.description}>
					<input
						id="description"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						className={fieldClass(Boolean(errs.description))}
					/>
				</Field>
				<Field label="Unit price" htmlFor="unitPrice" error={errs.unitPrice}>
					<input
						id="unitPrice"
						type="number"
						min="0.01"
						step="0.01"
						required
						value={unitPrice}
						onChange={(e) => setUnitPrice(e.target.value)}
						className={`w-32 ${fieldClass(Boolean(errs.unitPrice))}`}
					/>
				</Field>
				<FieldButtonSlot>
					<div className="flex gap-2">
						<Button variant="secondary" onClick={onDone}>
							Cancel
						</Button>
						<Button type="submit" loading={createProduct.isPending}>
							Create product
						</Button>
					</div>
				</FieldButtonSlot>
			</form>
		</Card>
	);
}

export function ProductListPage() {
	const { isAdmin } = useAuth();
	const { q, page, setQ, setPage, clear } = useListParams();
	const productsQuery = useProducts(page, q || undefined);
	const [creating, setCreating] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);

	return (
		<>
			<PageHeader
				title="Products"
				description="Catalogue priced into tender lines."
				actions={
					isAdmin &&
					!creating && (
						<Button onClick={() => setCreating(true)}>
							<Plus className="size-3.5" aria-hidden="true" /> New product
						</Button>
					)
				}
			/>

			{creating && <CreateProductForm onDone={() => setCreating(false)} />}

			<div className="space-y-4">
				<SearchInput
					value={q}
					onSearch={setQ}
					placeholder="Search by name or description"
					className="w-full sm:w-80"
				/>

				{productsQuery.error && <ErrorMessage error={productsQuery.error} />}

				{productsQuery.isLoading ? (
					<TableSkeleton rows={6} cols={4} />
				) : productsQuery.data?.total === 0 ? (
					<EmptyState
						icon={q ? SearchX : Package}
						title={q ? "No products match your search" : "No products yet"}
						description={
							q ? "Try a different name or description." : "Products added here can be priced into tenders."
						}
						action={
							q ? (
								<button
									type="button"
									onClick={clear}
									className="text-[13px] font-medium text-primary hover:underline"
								>
									Clear search
								</button>
							) : undefined
						}
					/>
				) : (
					<Table>
						<THead>
							<tr>
								<TH>Name</TH>
								<TH>Description</TH>
								<TH numeric>Price</TH>
								{isAdmin && <TH>Status</TH>}
								<TH className="w-1">
									<span className="sr-only">Actions</span>
								</TH>
							</tr>
						</THead>
						<TBody>
							{(productsQuery.data?.data ?? []).map((product) =>
								editingId === product.id ? (
									<ProductEditRow key={product.id} product={product} onDone={() => setEditingId(null)} />
								) : (
									<ProductRow key={product.id} product={product} onEdit={() => setEditingId(product.id)} />
								),
							)}
						</TBody>
					</Table>
				)}

				{productsQuery.data && <Pagination meta={productsQuery.data} onChange={setPage} />}
			</div>
		</>
	);
}

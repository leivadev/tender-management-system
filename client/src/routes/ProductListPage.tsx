import { useState } from "react";
import type { Product } from "../api/types";
import { Button } from "../components/Button";
import { Field, FieldButtonSlot } from "../components/Field";
import { Pagination } from "../components/Pagination";
import { PageLoader } from "../components/Spinner";
import { useCreateProduct, useProducts, useUpdateProduct } from "../hooks/useProducts";
import { useAuth } from "../lib/AuthContext";
import { formatCurrency } from "../lib/format";
import { inputClass } from "../lib/formStyles";
import { pushToast } from "../lib/toast";

function ProductRow({ product, onEdit }: { product: Product; onEdit: () => void }) {
	const { isAdmin } = useAuth();
	return (
		<tr className="border-t border-gray-100 hover:bg-gray-50">
			<td className="px-4 py-2">{product.name}</td>
			<td className="px-4 py-2">{product.description || "—"}</td>
			<td className="px-4 py-2">{formatCurrency(product.unitPrice)}</td>
			{isAdmin && (
				<td className="px-4 py-2">
					<span className={product.active ? "text-green-700" : "text-gray-500"}>
						{product.active ? "Active" : "Inactive"}
					</span>
				</td>
			)}
			<td className="px-4 py-2 text-right">
				{isAdmin && (
					<Button variant="link" onClick={onEdit}>
						Edit
					</Button>
				)}
			</td>
		</tr>
	);
}

function ProductEditRow({ product, onDone }: { product: Product; onDone: () => void }) {
	const updateProduct = useUpdateProduct();
	const [name, setName] = useState(product.name);
	const [description, setDescription] = useState(product.description ?? "");
	const [unitPrice, setUnitPrice] = useState(product.unitPrice);
	const [active, setActive] = useState(product.active);

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
		<tr className="border-t border-gray-100 bg-blue-50/40">
			<td className="px-4 py-2">
				<input
					value={name}
					onChange={(e) => setName(e.target.value)}
					className={`${inputClass} py-1`}
					minLength={2}
					required
				/>
			</td>
			<td className="px-4 py-2">
				<input
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					className={`${inputClass} py-1`}
				/>
			</td>
			<td className="px-4 py-2">
				<input
					type="number"
					min="0.01"
					step="0.01"
					value={unitPrice}
					onChange={(e) => setUnitPrice(e.target.value)}
					className={`w-28 ${inputClass} py-1`}
					required
				/>
			</td>
			<td className="px-4 py-2">
				<label className="flex items-center gap-2">
					<input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
					Active
				</label>
			</td>
			<td className="px-4 py-2 text-right">
				<div className="flex justify-end gap-2">
					<Button variant="secondary" onClick={onDone}>
						Cancel
					</Button>
					<Button loading={updateProduct.isPending} onClick={handleSave}>
						Save
					</Button>
				</div>
			</td>
		</tr>
	);
}

export function ProductListPage() {
	const [page, setPage] = useState(1);
	const productsQuery = useProducts(page);
	const createProduct = useCreateProduct();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [unitPrice, setUnitPrice] = useState("");
	const { isAdmin } = useAuth();
	const [editingId, setEditingId] = useState<string | null>(null);

	function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
		e.preventDefault();
		createProduct.mutate(
			{ name: name.trim(), description: description.trim() || undefined, unitPrice: Number(unitPrice) },
			{
				onSuccess: () => {
					setName("");
					setDescription("");
					setUnitPrice("");
					pushToast("Product created.");
				},
			},
		);
	}

	return (
		<div className="space-y-6">
			{isAdmin && (
				<form
					onSubmit={handleSubmit}
					className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4"
				>
					<Field label="Name" htmlFor="name">
						<input
							id="name"
							required
							minLength={2}
							value={name}
							onChange={(e) => setName(e.target.value)}
							className={inputClass}
						/>
					</Field>
					<Field label="Description" htmlFor="description">
						<input
							id="description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							className={inputClass}
						/>
					</Field>
					<Field label="Unit price" htmlFor="unitPrice">
						<input
							id="unitPrice"
							type="number"
							min="0.01"
							step="0.01"
							required
							value={unitPrice}
							onChange={(e) => setUnitPrice(e.target.value)}
							className={`w-32 ${inputClass}`}
						/>
					</Field>
					<FieldButtonSlot>
						<Button type="submit" loading={createProduct.isPending}>
							Create product
						</Button>
					</FieldButtonSlot>
				</form>
			)}

			{productsQuery.isLoading ? (
				<PageLoader />
			) : (
				<div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
					<table className="w-full text-sm">
						<thead className="text-left text-xs text-gray-500">
							<tr>
								<th className="px-4 py-2">Name</th>
								<th className="px-4 py-2">Description</th>
								<th className="px-4 py-2">Price</th>
								{isAdmin && <th className="px-4 py-2">Status</th>}
								<th className="px-4 py-2" />
							</tr>
						</thead>
						<tbody>
							{(productsQuery.data?.data ?? []).map((product) =>
								editingId === product.id ? (
									<ProductEditRow key={product.id} product={product} onDone={() => setEditingId(null)} />
								) : (
									<ProductRow key={product.id} product={product} onEdit={() => setEditingId(product.id)} />
								),
							)}
						</tbody>
					</table>
					{productsQuery.data?.total === 0 && (
						<p className="px-4 py-6 text-center text-sm text-gray-500">No products yet.</p>
					)}
				</div>
			)}

			{productsQuery.data && <Pagination meta={productsQuery.data} onChange={setPage} />}
		</div>
	);
}

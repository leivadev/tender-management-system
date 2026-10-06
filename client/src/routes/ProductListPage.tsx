import { useState } from "react";
import type { Product } from "../api/types";
import { Button } from "../components/Button";
import { ErrorMessage } from "../components/ErrorMessage";
import { Field, FieldButtonSlot } from "../components/Field";
import { PageLoader } from "../components/Spinner";
import { useCreateProduct, useProducts, useUpdateProduct } from "../hooks/useProducts";
import { useAuth } from "../lib/AuthContext";
import { formatCurrency } from "../lib/format";
import { inputClass } from "../lib/formStyles";
import { pushToast } from "../lib/toast";

function ProductRow({ product, onEdit }: { product: Product; onEdit: () => void }) {
	const { canWrite } = useAuth();
	return (
		<tr className="border-t border-gray-100 hover:bg-gray-50">
			<td className="px-4 py-2">{product.name}</td>
			<td className="px-4 py-2">{product.description || "—"}</td>
			<td className="px-4 py-2">{formatCurrency(product.unitPrice)}</td>
			<td className="px-4 py-2 text-right">
				{canWrite && (
					<Button variant="link" onClick={onEdit}>
						Editar
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

	function handleSave() {
		updateProduct.mutate(
			{
				id: product.id,
				payload: {
					name: name.trim(),
					description: description.trim() || undefined,
					unitPrice: Number(unitPrice),
				},
			},
			{
				onSuccess: () => {
					pushToast("Producto actualizado.");
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
			<td className="px-4 py-2 text-right">
				<div className="flex justify-end gap-2">
					<Button variant="secondary" onClick={onDone}>
						Cancelar
					</Button>
					<Button loading={updateProduct.isPending} onClick={handleSave}>
						Guardar
					</Button>
				</div>
			</td>
		</tr>
	);
}

export function ProductListPage() {
	const productsQuery = useProducts();
	const createProduct = useCreateProduct();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [unitPrice, setUnitPrice] = useState("");
	const { canWrite } = useAuth();
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
					pushToast("Producto creado.");
				},
			},
		);
	}

	return (
		<div className="space-y-6">
			{canWrite && (
				<form
					onSubmit={handleSubmit}
					className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4"
				>
					<Field label="Nombre" htmlFor="name">
						<input
							id="name"
							required
							minLength={2}
							value={name}
							onChange={(e) => setName(e.target.value)}
							className={inputClass}
						/>
					</Field>
					<Field label="Descripción" htmlFor="description">
						<input
							id="description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							className={inputClass}
						/>
					</Field>
					<Field label="Precio unitario" htmlFor="unitPrice">
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
							Crear producto
						</Button>
					</FieldButtonSlot>
				</form>
			)}

			<ErrorMessage error={createProduct.error} />

			{productsQuery.isLoading ? (
				<PageLoader />
			) : (
				<div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
					<table className="w-full text-sm">
						<thead className="text-left text-xs text-gray-500">
							<tr>
								<th className="px-4 py-2">Nombre</th>
								<th className="px-4 py-2">Descripción</th>
								<th className="px-4 py-2">Precio</th>
								<th className="px-4 py-2" />
							</tr>
						</thead>
						<tbody>
							{(productsQuery.data ?? []).map((product) =>
								editingId === product.id ? (
									<ProductEditRow key={product.id} product={product} onDone={() => setEditingId(null)} />
								) : (
									<ProductRow key={product.id} product={product} onEdit={() => setEditingId(product.id)} />
								),
							)}
						</tbody>
					</table>
					{productsQuery.data?.length === 0 && (
						<p className="px-4 py-6 text-center text-sm text-gray-500">No hay productos todavía.</p>
					)}
				</div>
			)}
		</div>
	);
}

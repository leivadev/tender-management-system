import { useState } from "react";
import { Button } from "../../components/Button";
import { Field, FieldButtonSlot } from "../../components/Field";
import { useAllProducts } from "../../hooks/useProducts";
import { useAddTenderProduct, useRemoveTenderProduct } from "../../hooks/useTenders";
import { useAuth } from "../../lib/AuthContext";
import { confirmAction } from "../../lib/confirm";
import { formatCurrency } from "../../lib/format";
import { fieldClass, inputClass } from "../../lib/formStyles";
import { pushToast } from "../../lib/toast";
import { useTenderContext } from "./context";

const EDITABLE_STATUSES = new Set(["draft", "active"]);

export function ProductsTab() {
	const { tender } = useTenderContext();
	const productsQuery = useAllProducts();
	const activeProducts = (productsQuery.data ?? []).filter((p) => p.active);
	const addProduct = useAddTenderProduct(tender.id);
	const removeProduct = useRemoveTenderProduct(tender.id);
	const [productId, setProductId] = useState("");
	const [quantity, setQuantity] = useState("1");
	const [budgetError, setBudgetError] = useState<string | null>(null);

	const { canWrite } = useAuth();
	const statusEditable = EDITABLE_STATUSES.has(tender.status);
	const editable = canWrite && statusEditable;
	const usedBudget = tender.products.reduce((sum, p) => sum + Number(p.subtotal), 0);
	const remainingBudget = Number(tender.maxBudget) - usedBudget;
	const selectedProduct = productsQuery.data?.find((p) => p.id === productId);

	function handleAdd(e: React.SubmitEvent<HTMLFormElement>) {
		e.preventDefault();

		if (selectedProduct) {
			const subtotal = Number(selectedProduct.unitPrice) * Number(quantity);
			if (subtotal > remainingBudget) {
				setBudgetError(
					`The subtotal (${formatCurrency(subtotal)}) exceeds the remaining budget (${formatCurrency(Math.max(0, remainingBudget))}).`,
				);
				return;
			}
		}
		setBudgetError(null);

		addProduct.mutate(
			{ productId, quantity: Number(quantity) },
			{
				onSuccess: () => {
					setProductId("");
					setQuantity("1");
					pushToast("Product added.");
				},
			},
		);
	}

	async function handleRemove(productLineId: string, productName: string) {
		const confirmed = await confirmAction({
			title: `Remove "${productName}" from this tender?`,
			confirmLabel: "Remove",
			destructive: true,
		});
		if (!confirmed) return;
		removeProduct.mutate(productLineId, {
			onSuccess: () => pushToast("Product removed."),
		});
	}

	return (
		<div className="space-y-4">
			<div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
				<table className="w-full text-sm">
					<thead className="text-left text-xs text-gray-500">
						<tr>
							<th className="px-4 py-2">Product</th>
							<th className="px-4 py-2">Quantity</th>
							<th className="px-4 py-2">Unit price</th>
							<th className="px-4 py-2">Subtotal</th>
							{editable && <th className="px-4 py-2" />}
						</tr>
					</thead>
					<tbody>
						{tender.products.map((line) => (
							<tr key={line.id} className="border-t border-gray-100 hover:bg-gray-50">
								<td className="px-4 py-2">{line.productName}</td>
								<td className="px-4 py-2">{line.quantity}</td>
								<td className="px-4 py-2">{formatCurrency(line.unitPrice)}</td>
								<td className="px-4 py-2">{formatCurrency(line.subtotal)}</td>
								{editable && (
									<td className="px-4 py-2 text-right">
										<Button
											variant="link"
											loading={removeProduct.isPending}
											onClick={() => handleRemove(line.productId, line.productName)}
										>
											Remove
										</Button>
									</td>
								)}
							</tr>
						))}
					</tbody>
				</table>
				{tender.products.length === 0 && (
					<p className="px-4 py-6 text-center text-sm text-gray-500">No products added.</p>
				)}
			</div>

			{editable ? (
				<form
					onSubmit={handleAdd}
					className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4"
				>
					<Field label="Product" htmlFor="product">
						<select
							id="product"
							required
							value={productId}
							onChange={(e) => {
								setProductId(e.target.value);
								setBudgetError(null);
							}}
							className={inputClass}
						>
							<option value="" disabled>
								Select
							</option>
							{activeProducts.map((p) => (
								<option key={p.id} value={p.id}>
									{p.name} ({formatCurrency(p.unitPrice)})
								</option>
							))}
						</select>
					</Field>
					<Field label="Quantity" htmlFor="quantity" error={budgetError ?? undefined}>
						<input
							id="quantity"
							type="number"
							min="1"
							step="1"
							required
							value={quantity}
							onChange={(e) => {
								setQuantity(e.target.value);
								setBudgetError(null);
							}}
							className={`w-24 ${fieldClass(Boolean(budgetError))}`}
						/>
					</Field>
					<FieldButtonSlot>
						<Button type="submit" loading={addProduct.isPending}>
							Add
						</Button>
					</FieldButtonSlot>
					<FieldButtonSlot>
						<p className="text-xs text-gray-500">
							Remaining budget: {formatCurrency(Math.max(0, remainingBudget))}
						</p>
					</FieldButtonSlot>
				</form>
			) : (
				canWrite && (
					<p className="text-sm text-gray-400">
						Products can only be edited while the tender is draft or active.
					</p>
				)
			)}
		</div>
	);
}

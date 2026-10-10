import { Package } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { Field, FieldButtonSlot } from "../../components/Field";
import { Table, TBody, TD, TH, THead, TR } from "../../components/Table";
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
			{tender.products.length === 0 ? (
				<EmptyState
					icon={Package}
					title="No products yet"
					description={editable ? "Add the first product below." : "This tender has no product lines."}
				/>
			) : (
				<Table>
					<THead>
						<tr>
							<TH>Product</TH>
							<TH numeric>Quantity</TH>
							<TH numeric>Unit price</TH>
							<TH numeric>Subtotal</TH>
							{editable && <TH />}
						</tr>
					</THead>
					<TBody>
						{tender.products.map((line) => (
							<TR key={line.id}>
								<TD className="font-medium">{line.productName}</TD>
								<TD numeric>{Number(line.quantity).toLocaleString("en-US")}</TD>
								<TD numeric className="text-muted-foreground">
									{formatCurrency(line.unitPrice)}
								</TD>
								<TD numeric>{formatCurrency(line.subtotal)}</TD>
								{editable && (
									<TD className="text-right">
										<Button
											variant="link"
											loading={removeProduct.isPending}
											onClick={() => handleRemove(line.productId, line.productName)}
										>
											Remove
										</Button>
									</TD>
								)}
							</TR>
						))}
						<TR className="bg-muted/50 font-semibold hover:bg-muted/50">
							<TD colSpan={3}>Total</TD>
							<TD numeric>{formatCurrency(usedBudget)}</TD>
							{editable && <TD />}
						</TR>
					</TBody>
				</Table>
			)}

			{editable ? (
				<form
					onSubmit={handleAdd}
					className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-card p-4 shadow-card"
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
						<p className="text-xs text-muted-foreground">
							Remaining budget: {formatCurrency(Math.max(0, remainingBudget))}
						</p>
					</FieldButtonSlot>
				</form>
			) : (
				canWrite && (
					<p className="text-[13px] text-muted-foreground">
						Products can only be edited while the tender is draft or active.
					</p>
				)
			)}
		</div>
	);
}

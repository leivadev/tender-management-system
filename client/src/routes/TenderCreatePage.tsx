import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fieldErrors } from "../api/errors";
import { Button, buttonClasses } from "../components/Button";
import { Card } from "../components/Card";
import { Field } from "../components/Field";
import { PageHeader } from "../components/PageHeader";
import { useAllClients } from "../hooks/useClients";
import { useCreateTender } from "../hooks/useTenders";
import { toLocalInputValue } from "../lib/datetime";
import { fieldClass } from "../lib/formStyles";
import { pushToast } from "../lib/toast";

export function TenderCreatePage() {
	const navigate = useNavigate();
	const clientsQuery = useAllClients();
	const createTender = useCreateTender();

	const [clientId, setClientId] = useState("");
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [maxBudget, setMaxBudget] = useState("");
	const [deadline, setDeadline] = useState("");
	const [deadlineError, setDeadlineError] = useState<string | null>(null);
	const errs = fieldErrors(createTender.error);

	const minDeadline = toLocalInputValue(new Date());
	const hasClients = (clientsQuery.data?.length ?? 0) > 0;

	async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
		e.preventDefault();

		if (new Date(deadline).getTime() <= Date.now()) {
			setDeadlineError("The deadline must be in the future.");
			return;
		}
		setDeadlineError(null);

		const tender = await createTender.mutateAsync({
			clientId,
			title: title.trim(),
			description: description.trim() || undefined,
			maxBudget: Number(maxBudget),
			deadline: new Date(deadline).toISOString(),
		});
		pushToast("Tender created.");
		navigate(`/tenders/${tender.tender.id}`);
	}

	return (
		<>
			<PageHeader
				title="New tender"
				description="Start with the basics. You can add products and the proposal afterwards."
				crumbs={[{ label: "Tenders", to: "/tenders" }, { label: "New tender" }]}
			/>

			<Card className="max-w-2xl">
				<form onSubmit={handleSubmit} className="space-y-3 p-5">
					{!clientsQuery.isLoading && !hasClients && (
						<p className="mb-3 rounded-ctl bg-[color:var(--tone-warning-bg)] px-3 py-2 text-[13px] text-[color:var(--tone-warning-fg)]">
							There are no clients yet.{" "}
							<Link to="/clients" className="font-medium underline">
								Create one first
							</Link>
							.
						</p>
					)}

					<div className="grid gap-x-4 sm:grid-cols-2">
						<Field label="Client" htmlFor="client" error={errs.clientId}>
							<select
								id="client"
								required
								value={clientId}
								onChange={(e) => setClientId(e.target.value)}
								className={fieldClass(Boolean(errs.clientId))}
							>
								<option value="" disabled>
									Select a client
								</option>
								{(clientsQuery.data ?? []).map((client) => (
									<option key={client.id} value={client.id}>
										{client.name}
									</option>
								))}
							</select>
						</Field>

						<Field label="Title" htmlFor="title" error={errs.title}>
							<input
								id="title"
								required
								minLength={3}
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								className={fieldClass(Boolean(errs.title))}
							/>
						</Field>
					</div>

					<Field label="Description" htmlFor="description" hint="Optional" error={errs.description}>
						<textarea
							id="description"
							rows={3}
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							className={`${fieldClass(Boolean(errs.description))} h-auto py-1.5`}
						/>
					</Field>

					<div className="grid gap-x-4 sm:grid-cols-2">
						<Field
							label="Maximum budget"
							htmlFor="maxBudget"
							hint="USD, the cap for all product lines"
							error={errs.maxBudget}
						>
							<input
								id="maxBudget"
								type="number"
								min="0.01"
								step="0.01"
								required
								value={maxBudget}
								onChange={(e) => setMaxBudget(e.target.value)}
								className={fieldClass(Boolean(errs.maxBudget))}
							/>
						</Field>

						<Field label="Deadline" htmlFor="deadline" error={deadlineError ?? errs.deadline}>
							<input
								id="deadline"
								type="datetime-local"
								min={minDeadline}
								required
								value={deadline}
								onChange={(e) => {
									setDeadline(e.target.value);
									setDeadlineError(null);
								}}
								className={fieldClass(Boolean(deadlineError ?? errs.deadline))}
							/>
						</Field>
					</div>

					<div className="flex justify-end gap-2 border-t border-border pt-4">
						<Link to="/tenders" className={buttonClasses("secondary")}>
							Cancel
						</Link>
						<Button type="submit" loading={createTender.isPending} disabled={!hasClients}>
							{createTender.isPending ? "Creating…" : "Create tender"}
						</Button>
					</div>
				</form>
			</Card>
		</>
	);
}

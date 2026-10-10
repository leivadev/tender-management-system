import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { ConfirmHost } from "./components/ConfirmHost";
import { Layout } from "./components/Layout";
import { RequireAdmin, RequireAuth } from "./components/RequireAuth";
import { TooltipProvider } from "./components/Tooltip";
import { LoginPage } from "./routes/LoginPage";
import { NotFoundPage } from "./routes/NotFoundPage";

// Route pages are code-split so the login screen does not download Recharts and every list page.
const ClientListPage = lazy(() =>
	import("./routes/ClientListPage").then((m) => ({ default: m.ClientListPage })),
);
const DashboardPage = lazy(() =>
	import("./routes/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const ProductListPage = lazy(() =>
	import("./routes/ProductListPage").then((m) => ({ default: m.ProductListPage })),
);
const TenderCreatePage = lazy(() =>
	import("./routes/TenderCreatePage").then((m) => ({ default: m.TenderCreatePage })),
);
const TenderListPage = lazy(() =>
	import("./routes/TenderListPage").then((m) => ({ default: m.TenderListPage })),
);
const UserListPage = lazy(() => import("./routes/UserListPage").then((m) => ({ default: m.UserListPage })));
const TenderDetailLayout = lazy(() =>
	import("./routes/tender-detail/TenderDetailLayout").then((m) => ({ default: m.TenderDetailLayout })),
);
const HistoryTab = lazy(() =>
	import("./routes/tender-detail/HistoryTab").then((m) => ({ default: m.HistoryTab })),
);
const OverviewTab = lazy(() =>
	import("./routes/tender-detail/OverviewTab").then((m) => ({ default: m.OverviewTab })),
);
const PaymentsTab = lazy(() =>
	import("./routes/tender-detail/PaymentsTab").then((m) => ({ default: m.PaymentsTab })),
);
const ProductsTab = lazy(() =>
	import("./routes/tender-detail/ProductsTab").then((m) => ({ default: m.ProductsTab })),
);
const ProposalTab = lazy(() =>
	import("./routes/tender-detail/ProposalTab").then((m) => ({ default: m.ProposalTab })),
);

export default function App() {
	return (
		<BrowserRouter>
			<TooltipProvider>
				<Toaster position="bottom-right" closeButton />
				<ConfirmHost />
				<Routes>
					<Route path="/login" element={<LoginPage />} />
					<Route
						path="/*"
						element={
							<RequireAuth>
								<Layout>
									<Suspense fallback={<div className="h-64" aria-busy="true" />}>
										<Routes>
											<Route path="/" element={<DashboardPage />} />
											<Route path="/tenders" element={<TenderListPage />} />
											<Route path="/tenders/new" element={<TenderCreatePage />} />
											<Route path="/tenders/:id" element={<TenderDetailLayout />}>
												<Route index element={<OverviewTab />} />
												<Route path="products" element={<ProductsTab />} />
												<Route path="proposal" element={<ProposalTab />} />
												<Route path="payments" element={<PaymentsTab />} />
												<Route path="history" element={<HistoryTab />} />
											</Route>
											<Route path="/clients" element={<ClientListPage />} />
											<Route path="/products" element={<ProductListPage />} />
											<Route
												path="/users"
												element={
													<RequireAdmin>
														<UserListPage />
													</RequireAdmin>
												}
											/>
											<Route path="*" element={<NotFoundPage />} />
										</Routes>
									</Suspense>
								</Layout>
							</RequireAuth>
						}
					/>
				</Routes>
			</TooltipProvider>
		</BrowserRouter>
	);
}

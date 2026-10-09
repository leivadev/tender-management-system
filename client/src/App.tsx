import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { ToastContainer } from "./components/ToastContainer";
import { ClientListPage } from "./routes/ClientListPage";
import { DashboardPage } from "./routes/DashboardPage";
import { LoginPage } from "./routes/LoginPage";
import { NotFoundPage } from "./routes/NotFoundPage";
import { ProductListPage } from "./routes/ProductListPage";
import { TenderCreatePage } from "./routes/TenderCreatePage";
import { TenderListPage } from "./routes/TenderListPage";
import { HistoryTab } from "./routes/tender-detail/HistoryTab";
import { OverviewTab } from "./routes/tender-detail/OverviewTab";
import { PaymentsTab } from "./routes/tender-detail/PaymentsTab";
import { ProductsTab } from "./routes/tender-detail/ProductsTab";
import { ProposalTab } from "./routes/tender-detail/ProposalTab";
import { TenderDetailLayout } from "./routes/tender-detail/TenderDetailLayout";
import { UserListPage } from "./routes/UserListPage";

export default function App() {
	return (
		<BrowserRouter>
			<ToastContainer />
			<Routes>
				<Route path="/login" element={<LoginPage />} />
				<Route
					path="/*"
					element={
						<RequireAuth>
							<Layout>
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
									<Route path="/users" element={<UserListPage />} />
									<Route path="*" element={<NotFoundPage />} />
								</Routes>
							</Layout>
						</RequireAuth>
					}
				/>
			</Routes>
		</BrowserRouter>
	);
}

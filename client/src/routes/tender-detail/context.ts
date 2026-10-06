import { useOutletContext } from "react-router-dom";
import type { TenderDetail } from "../../api/types";

export function useTenderContext() {
	return useOutletContext<{ tender: TenderDetail }>();
}

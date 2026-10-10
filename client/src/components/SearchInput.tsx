import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { cn } from "../lib/cn";
import { inputClass } from "../lib/formStyles";

/**
 * Search box that reports the typed text through `onSearch` after a short pause. `value` is the
 * committed value (e.g. from the URL); it only overwrites the box when it changes from outside.
 */
export function SearchInput({
	value,
	onSearch,
	placeholder,
	className,
}: {
	value: string;
	onSearch: (value: string) => void;
	placeholder: string;
	className?: string;
}) {
	const [text, setText] = useState(value);
	const debounced = useDebouncedValue(text.trim());

	// Latest props, read inside the effect below so that only typing triggers a search.
	const latest = useRef({ value, onSearch });
	latest.current = { value, onSearch };

	useEffect(() => setText(value), [value]);
	useEffect(() => {
		if (debounced !== latest.current.value) latest.current.onSearch(debounced);
	}, [debounced]);

	return (
		<div className={cn("relative", className)}>
			<Search
				className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
			<input
				type="search"
				aria-label={placeholder}
				placeholder={placeholder}
				value={text}
				onChange={(e) => setText(e.target.value)}
				className={cn(inputClass, "pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden")}
			/>
			{text && (
				<button
					type="button"
					aria-label="Clear search"
					onClick={() => setText("")}
					className="absolute top-1/2 right-1.5 grid size-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground"
				>
					<X className="size-3.5" aria-hidden="true" />
				</button>
			)}
		</div>
	);
}

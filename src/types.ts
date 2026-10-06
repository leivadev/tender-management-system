import type { Context } from "hono";
import type { AppBindings } from "./middleware/auth";

export type { AppBindings };
export type AppContext = Context<AppBindings>;

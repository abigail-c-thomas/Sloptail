import { createContext, useContext } from "react";
import { DEFAULT_CATALOG, type Catalog } from "@sloptail/shared";

/** The event's active ingredient list, so recipes render with the right names. */
const CatalogContext = createContext<Catalog>(DEFAULT_CATALOG);

export const CatalogProvider = CatalogContext.Provider;

export function useCatalog(): Catalog {
  return useContext(CatalogContext);
}

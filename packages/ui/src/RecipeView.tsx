import { buildOrder, formatAmount, type Proposal, type Recipe } from "@sloptail/shared";
import { useCatalog } from "./CatalogContext.tsx";

/** Ingredient list in build order. `compact` for the bar screen; `decimal` writes parts as ".5". */
export function RecipeList({ recipe, compact, decimal }: { recipe: Recipe; compact?: boolean; decimal?: boolean }) {
  const catalog = useCatalog();
  return (
    <ol className={`recipe ${compact ? "compact" : ""}`}>
      {buildOrder(recipe, catalog).map((item, i) => {
        const ing = catalog.byId.get(item.ingredient);
        const garnish = ing?.type === "garnish";
        return (
          <li key={`${item.ingredient}-${i}`} className={garnish ? "garnish" : ""}>
            <span>{ing?.name ?? item.ingredient}</span>
            {garnish && item.amount === 1 ? null : <span className="amt">{formatAmount(item, ing, { decimal })}</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function ProposalCard({ proposal, subtitle }: { proposal: Proposal; subtitle?: string }) {
  return (
    <div className="card stack">
      <div className="stack" style={{ gap: 2 }}>
        <h2>{proposal.name}</h2>
        {subtitle ? <p className="muted small">“{subtitle}”</p> : null}
      </div>
      <p>{proposal.description}</p>
      <RecipeList recipe={proposal.recipe} />
      <p className="muted small">Built over ice · {proposal.glass} glass</p>
    </div>
  );
}

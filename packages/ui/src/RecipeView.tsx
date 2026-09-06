import { CATALOG_BY_ID, formatAmount, type Proposal, type Recipe } from "@sloptail/shared";

/** Ingredient list in build order. `compact` for the bar screen. */
export function RecipeList({ recipe, compact }: { recipe: Recipe; compact?: boolean }) {
  return (
    <ol className={`recipe ${compact ? "compact" : ""}`}>
      {recipe.map((item, i) => {
        const ing = CATALOG_BY_ID.get(item.ingredient);
        const garnish = ing?.type === "garnish";
        return (
          <li key={`${item.ingredient}-${i}`} className={garnish ? "garnish" : ""}>
            <span>{ing?.name ?? item.ingredient}</span>
            <span className="amt">{formatAmount(item, ing)}</span>
          </li>
        );
      })}
    </ol>
  );
}

const METHOD_TEXT = { build: "Built in the glass", shake: "Shaken", stir: "Stirred" } as const;

export function ProposalCard({ proposal, subtitle }: { proposal: Proposal; subtitle?: string }) {
  return (
    <div className="card stack">
      <div className="stack" style={{ gap: 2 }}>
        <h2>{proposal.name}</h2>
        {subtitle ? <p className="muted small">“{subtitle}”</p> : null}
      </div>
      <p>{proposal.description}</p>
      <RecipeList recipe={proposal.recipe} />
      <p className="muted small">
        {METHOD_TEXT[proposal.method]} · {proposal.glass} glass
      </p>
    </div>
  );
}

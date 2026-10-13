/**
 * Lines with a punchline that only lands after a set-up line: "Asking a
 * smaller model…", then "Retrying with a bigger model…". A sequel is never
 * picked on its own, and always comes next after its set-up.
 * Maps set-up -> sequel.
 */
export type Sequels = Readonly<Record<string, string>>;

/** The pool minus anything that's only allowed as a sequel. */
export function withoutSequels(pool: readonly string[], sequels: Sequels): string[] {
  const follow = new Set(Object.values(sequels));
  return pool.filter((x) => !follow.has(x));
}

/**
 * The next line in a rotation: the sequel if the previous line was a
 * set-up, otherwise a random line from the pool that isn't a sequel and
 * isn't the previous line again.
 */
export function nextLine(prev: string | undefined, pool: readonly string[], sequels: Sequels, random: () => number = Math.random): string {
  if (prev !== undefined && sequels[prev]) return sequels[prev];
  const options = withoutSequels(pool, sequels).filter((x) => x !== prev);
  return options[Math.floor(random() * options.length)] ?? pool[0]!;
}

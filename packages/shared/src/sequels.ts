/**
 * Lines with a punchline that only lands straight after a set-up line:
 * "Rolling at 6pm on a Friday", then "Rolling back at 6:05pm on a Friday".
 * A sequel is never picked on its own, and always follows its set-up.
 * Maps set-up -> sequel.
 */
export type Sequels = Readonly<Record<string, string>>;

/** The pool minus anything that's only allowed as a sequel. */
export function withoutSequels(pool: readonly string[], sequels: Sequels): string[] {
  const follow = new Set(Object.values(sequels));
  return pool.filter((x) => !follow.has(x));
}

/** A picked list with each set-up's sequel slotted in right after it. */
export function insertSequels(list: readonly string[], sequels: Sequels): string[] {
  return list.flatMap((x) => (sequels[x] ? [x, sequels[x]] : [x]));
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

export function Steps({ current, total }: { current: number; total: number }) {
  return (
    <div className="steps" aria-label={`step ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < current ? "done" : ""} />
      ))}
    </div>
  );
}

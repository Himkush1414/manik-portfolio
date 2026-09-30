// Three-line status log that types the REAL loader task names as each task
// starts/finishes (brief §8). Reads the loader store only.
import { useEffect, useRef, useState } from 'react';
import { useLoader, type TaskId } from '../../../core/loader';
import { STATUS_LINES } from '../../../data/boot.config';

type Props = { className: string; lineClass: string; caretClass: string };

export function LoaderLog({ className, lineClass, caretClass }: Props) {
  const running = useLoader(s => s.running);
  const completed = useLoader(s => s.completed);
  const [lines, setLines] = useState<string[]>([]);
  const [typed, setTyped] = useState(0);
  const seen = useRef(new Set<TaskId>());

  useEffect(() => {
    // queue each task's status line once, in completion order, then any still running
    const order = [...completed, ...running];
    const next: string[] = [];
    for (const id of order) {
      if (seen.current.has(id)) continue;
      seen.current.add(id);
      next.push(STATUS_LINES[id]);
    }
    if (next.length) setLines(l => [...l, ...next].slice(-3));
  }, [completed, running]);

  const last = lines[lines.length - 1] ?? '';
  useEffect(() => {
    setTyped(0);
  }, [last]);
  useEffect(() => {
    if (typed >= last.length) return;
    const id = requestAnimationFrame(() => setTyped(t => Math.min(last.length, t + 2)));
    return () => cancelAnimationFrame(id);
  }, [typed, last]);

  return (
    <ul className={className} aria-live="polite">
      {lines.map((l, i) => (
        <li key={`${l}-${i}`} className={lineClass}>
          {i === lines.length - 1 ? l.slice(0, typed) : l}
          {i === lines.length - 1 && <span className={caretClass} aria-hidden="true" />}
        </li>
      ))}
    </ul>
  );
}

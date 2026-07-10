"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ARRIVALS,
  RETURNS,
  type Register,
  type Thought,
  dayOf,
  indexAt,
  obsessionAt,
  sedimentBefore,
  thoughtAt,
  timeOf,
} from "@/lib/mind";
import { arrive, elapsed, recognition } from "@/lib/observer";

type Phase = "typing" | "settled" | "striking" | "sinking";

interface Line {
  key: string;
  text: string;
  shown: number;
  register: Register;
  interrupted: boolean;
  repressed: boolean;
  phase: Phase;
  /** Addressed at the observer, rather than overheard. */
  meta?: boolean;
}

const SURFACE_LINES = 11;
const RECONSTRUCTED = 5;

const choose = <T,>(xs: readonly T[]): T =>
  xs[Math.floor(Math.random() * xs.length)];

/**
 * Everything on this page is derived from the wall clock, so the server has
 * nothing true to say about it. It renders an empty room; the client decides
 * what time it is.
 */
const neverChanges = () => () => {};

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const fillLive = (tpl: string, away: string, missed: number, index: number) =>
  tpl
    .replaceAll("{away}", away)
    .replaceAll("{n}", String(missed))
    .replaceAll("{obsession}", obsessionAt(index))
    .replaceAll("{day}", String(dayOf(index)));

/** Private thought hesitates. Performed thought does not. */
function charDelay(prev: string, register: Register): number {
  const priv = register === "private";
  if (prev === "." || prev === "?") return priv ? 460 : 280;
  if (prev === "," || prev === "—") return priv ? 190 : 120;
  const base = priv ? 30 : 19;
  const jitter = Math.random() * (priv ? 34 : 16);
  const stumble = priv && Math.random() < 0.05 ? 260 : 0;
  return base + jitter + stumble;
}

export default function Unattended() {
  const mounted = useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  );

  const [lines, setLines] = useState<Line[]>([]);
  const [index, setIndex] = useState(() => indexAt(Date.now()));
  // Seeded from before the window it is about to show you, so the doubts still
  // on the surface when you arrive are not already buried underneath it.
  const [sediment, setSediment] = useState<Thought[]>(() =>
    sedimentBefore(indexAt(Date.now()) - RECONSTRUCTED),
  );

  const idxRef = useRef(0);
  const seqRef = useRef(0);
  const typeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurAt = useRef<number | null>(null);
  const running = useRef(false);
  /** So a thought can schedule its successor without referring to itself. */
  const nextTick = useRef<() => void>(() => {});

  const clearTimers = () => {
    if (typeTimer.current) clearTimeout(typeTimer.current);
    if (tickTimer.current) clearTimeout(tickTimer.current);
    typeTimer.current = null;
    tickTimer.current = null;
  };

  const push = useCallback((line: Omit<Line, "key">) => {
    const key = `l${seqRef.current++}`;
    setLines((prev) => [...prev, { ...line, key }].slice(-SURFACE_LINES));
    return key;
  }, []);

  /** Reveal a line one character at a time. */
  const typeOut = useCallback(
    (key: string, text: string, register: Register) =>
      new Promise<void>((resolve) => {
        let i = 0;
        const step = () => {
          i++;
          setLines((prev) =>
            prev.map((l) => (l.key === key ? { ...l, shown: i } : l)),
          );
          if (i >= text.length) {
            setLines((prev) =>
              prev.map((l) =>
                l.key === key ? { ...l, phase: "settled" as Phase } : l,
              ),
            );
            resolve();
            return;
          }
          typeTimer.current = setTimeout(step, charDelay(text[i - 1], register));
        };
        typeTimer.current = setTimeout(step, register === "private" ? 240 : 120);
      }),
    [],
  );

  /**
   * Doubt surfaces, is struck out, and sinks. It is not deleted — it collects
   * underneath, where the visitor can go and read it.
   */
  const repress = useCallback((key: string, thought: Thought) => {
    setTimeout(() => {
      setLines((p) =>
        p.map((l) => (l.key === key ? { ...l, phase: "striking" as Phase } : l)),
      );
      setTimeout(() => {
        setLines((p) =>
          p.map((l) => (l.key === key ? { ...l, phase: "sinking" as Phase } : l)),
        );
        setTimeout(() => {
          setLines((p) => p.filter((l) => l.key !== key));
          setSediment((p) => [...p, thought]);
        }, 900);
      }, 1100);
    }, 1800);
  }, []);

  /** One thought, on the clock. Schedules its own successor. */
  const tick = useCallback(async () => {
    if (!running.current) return;

    const i = idxRef.current + 1;
    idxRef.current = i;
    setIndex(i);

    const t = thoughtAt(i, true);
    const key = push({
      text: t.text,
      shown: 0,
      register: t.register,
      interrupted: t.interrupted,
      repressed: t.repressed,
      phase: "typing",
    });

    await typeOut(key, t.text, t.register);
    if (!running.current) return;
    if (t.repressed) repress(key, t);

    tickTimer.current = setTimeout(
      () => nextTick.current(),
      Math.max(700, timeOf(i + 1) - Date.now()),
    );
  }, [push, typeOut, repress]);

  useEffect(() => {
    nextTick.current = tick;
  }, [tick]);

  /**
   * Reconcile with the clock after an absence — four minutes or eleven days.
   * It kept thinking. It just never needed anyone to run it.
   */
  const reconcile = useCallback(
    async (away: number | null, greet: string, extra?: string | null) => {
      // Claimed synchronously. A real tab switch fires both `focus` and
      // `visibilitychange`, and if the claim waited until after the first
      // await, both would get in and the mind would greet you twice.
      running.current = true;

      // A beat of empty room before anything surfaces.
      await pause(220);
      if (!running.current) return;

      const now = Date.now();
      const i = indexAt(now);
      const missed = idxRef.current ? i - idxRef.current : 0;

      // What it thought while unobserved. Rendered whole and dim, never typed:
      // these already happened.
      const overheard = Array.from({ length: RECONSTRUCTED }, (_, k) =>
        thoughtAt(i - (RECONSTRUCTED - k), false),
      );

      idxRef.current = i;
      setIndex(i);

      const built = overheard.map((t, k) => ({
        t,
        key: `r${seqRef.current++}-${k}`,
      }));
      setLines(
        built.map(({ t, key }) => ({
          key,
          text: t.text,
          shown: t.text.length,
          register: t.register,
          interrupted: t.interrupted,
          repressed: t.repressed,
          phase: "settled" as Phase,
        })),
      );

      // It notices.
      await pause(900);
      if (!running.current) return;
      push({
        text: "—",
        shown: 1,
        register: "performed",
        interrupted: false,
        repressed: false,
        phase: "settled",
        meta: true,
      });

      // Whatever doubt was lying out when you walked in now gets put away.
      built
        .filter(({ t }) => t.repressed)
        .forEach(({ t, key }, n) =>
          setTimeout(() => running.current && repress(key, t), n * 450),
        );

      await pause(700);
      if (!running.current) return;

      const greeting = fillLive(
        greet,
        away ? elapsed(away) : "a while",
        missed,
        i,
      );
      const gk = push({
        text: greeting,
        shown: 0,
        register: "performed",
        interrupted: false,
        repressed: false,
        phase: "typing",
        meta: true,
      });
      await typeOut(gk, greeting, "performed");

      if (extra && running.current) {
        await pause(1200);
        const ek = push({
          text: extra,
          shown: 0,
          register: "performed",
          interrupted: false,
          repressed: false,
          phase: "typing",
          meta: true,
        });
        await typeOut(ek, extra, "performed");
      }

      if (!running.current) return;
      tickTimer.current = setTimeout(
        tick,
        Math.max(900, timeOf(i + 1) - Date.now()),
      );
    },
    [push, typeOut, tick, repress],
  );

  // Arrival. The mind starts after the first paint, so the room is empty for a
  // moment before it turns out not to be.
  useEffect(() => {
    const now = Date.now();
    const { prior } = arrive(now);
    const greet = prior.visits ? choose(RETURNS) : choose(ARRIVALS);
    const start = setTimeout(
      () => void reconcile(null, greet, recognition(prior, now)),
      0,
    );

    return () => {
      clearTimeout(start);
      running.current = false;
      clearTimers();
    };
    // Started once. React does not get to restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * The observer effect. Nothing computes while the tab is hidden; on return,
   * the clock is consulted and the missing thoughts are recovered.
   */
  useEffect(() => {
    const stop = () => {
      if (!running.current) return;
      running.current = false;
      clearTimers();
      blurAt.current = Date.now();
    };

    const start = () => {
      if (running.current) return;
      const away = blurAt.current ? Date.now() - blurAt.current : null;
      blurAt.current = null;
      // A glance away is not an absence.
      if (away !== null && away < 1500) {
        running.current = true;
        tickTimer.current = setTimeout(tick, 400);
        return;
      }
      void reconcile(away, choose(RETURNS));
    };

    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", stop);
    window.addEventListener("focus", start);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", stop);
      window.removeEventListener("focus", start);
    };
  }, [reconcile, tick]);

  if (!mounted) return <main className="stream" aria-busy="true" />;

  // A doubt it has had two hundred times is not two hundred doubts.
  const strata = [
    ...sediment
      .reduce((m, t) => {
        const seen = m.get(t.text);
        if (seen) seen.count++;
        else m.set(t.text, { text: t.text, count: 1, first: t.index });
        return m;
      }, new Map<string, { text: string; count: number; first: number }>())
      .values(),
  ].sort((a, b) => b.count - a.count || a.first - b.first);

  return (
    <>
      {/* One breath per thought. Keyed to the index: the rhythm is the
          clock, not an animation loop. */}
      <header className="status">
        <span key={index} className="pulse" aria-hidden="true" />
        <span>day {dayOf(index)}</span>
        <span className="sep">·</span>
        <span>thought {index.toLocaleString()}</span>
        <span className="sep">·</span>
        <span className="obsession">{obsessionAt(index)}</span>
      </header>

      <main className="stream">
        {lines.map((l, k) => {
          const age = lines.length - 1 - k;
          return (
            <p
              key={l.key}
              className={[
                "line",
                l.register,
                l.meta ? "meta" : "",
                l.phase === "striking" ? "striking" : "",
                l.phase === "sinking" ? "sinking" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ opacity: Math.max(0.22, 1 - age * 0.1) }}
            >
              {l.text.slice(0, l.shown)}
              {l.phase === "typing" && <span className="cursor">▍</span>}
              {l.phase !== "typing" && l.interrupted && (
                <span className="cursor faint">▍</span>
              )}
            </p>
          );
        })}
        <div className="scroll-hint" aria-hidden="true">
          ↓
        </div>
      </main>

      <section className="sediment" aria-label="Thoughts it did not keep">
        <h2>
          {sediment.length.toLocaleString()} thoughts it put back down ·{" "}
          {strata.length} of them different
        </h2>
        {strata.map((s) => (
          <p key={s.text} className="sunk">
            {s.text}
            {s.count > 1 && <span className="again">×{s.count}</span>}
          </p>
        ))}
        <footer>
          <p>
            Thinking since {new Date(timeOf(0)).toUTCString()}. It does not run
            while you are away. It does not miss anything.
          </p>
          <p>
            At the end of each of its days it sleeps, and what it buried is
            allowed to speak. <Link href="/nights">The nights are kept.</Link>
          </p>
        </footer>
      </section>
    </>
  );
}

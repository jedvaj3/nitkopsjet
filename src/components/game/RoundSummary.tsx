import { useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Gem,
  Heart,
  HeartCrack,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  bodova,
  isMultiplayer,
  lowestAnswers,
  playerColor,
  roundSidePoints,
  sideColor,
  sideName,
  sideOf,
  standings,
  usesLives,
} from "@/game/engine";
import type { GameConfig, Round } from "@/game/types";
import { answerLabel } from "@/game/meaning";
import { JudgeNote } from "./PlayTurn";

interface Props {
  round: Round;
  roundNumber: number;
  totalRounds: number;
  config: GameConfig;
  lives: number[];
  maxLives: number;
  isLast: boolean;
  played: Round[];
  onNext: () => void;
}

export function RoundSummary({
  round,
  roundNumber,
  totalRounds,
  config,
  lives,
  maxLives,
  isLast,
  played,
  onNext,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const q = round.question;
  const gems = lowestAnswers(q);
  const sorted = [...q.answers].sort((a, b) => a.points - b.points);
  const given = new Set(round.turns.map((t) => t.answerIndex));
  const givenTexts = new Set(
    round.turns
      .map((t) =>
        t.answerIndex !== null ? q.answers[t.answerIndex]?.text : null,
      )
      .filter((t): t is string => Boolean(t)),
  );
  const multi = isMultiplayer(config);
  const withLives = usesLives(config);
  const teams = config.mode === "teams";

  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="mb-2 text-center font-display text-xs tracking-[0.25em] text-muted-foreground uppercase">
        Pregled runde {roundNumber}/{totalRounds}
      </p>
      <h2 className="mb-6 text-center font-display text-xl font-bold text-balance sm:text-2xl">
        {q.text}
      </h2>

      {/* Turns */}
      <div className={cn("grid gap-3", multi && "sm:grid-cols-2")}>
        {round.turns.map((t) => {
          const label = answerLabel(q, t);
          const a = label ? { text: label } : null;
          const side = sideOf(config, t.player);
          const lost = withLives && round.loser === side;
          return (
            <div
              key={`${t.player}-${t.slot ?? 0}`}
              className={cn(
                "panel rounded-2xl p-4",
                t.points === 0 && a && "gold-ring",
                lost && "ring-1 ring-rose-500/60",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  {multi && (
                    <p
                      className={cn(
                        "truncate text-sm font-bold",
                        playerColor(config, t.player).text,
                      )}
                    >
                      {config.players[t.player]}
                      {t.slot !== undefined && (
                        <span className="font-semibold opacity-75">
                          {" "}
                          · {t.slot + 1}. odgovor
                        </span>
                      )}
                      {teams && (
                        <span className="font-semibold opacity-75">
                          {" "}
                          · {sideName(config, side)}
                        </span>
                      )}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t.timedOut ? "Isteklo vrijeme" : `Upisano: „${t.input}”`}
                  </p>
                  <p className="truncate text-lg font-bold">
                    {a ? (
                      a.text
                    ) : (
                      <span className="text-rose-400">Netočno</span>
                    )}
                  </p>
                  {t.judge && t.judge !== "baza" && <JudgeNote turn={t} />}
                </div>
                <div
                  className={cn(
                    "font-display text-3xl font-black tabular-nums",
                    t.points === 0 && a
                      ? "text-gold"
                      : a
                        ? "text-neon"
                        : "text-rose-400",
                  )}
                >
                  {t.points}
                </div>
              </div>
              {withLives && !t.slot && (
                <div className="mt-3 flex items-center gap-1">
                  {Array.from({ length: maxLives }, (_, i) =>
                    i < lives[side] ? (
                      <Heart
                        key={i}
                        className="size-5 fill-rose-500 text-rose-500"
                      />
                    ) : (
                      <HeartCrack key={i} className="size-5 text-white/25" />
                    ),
                  )}
                  {lost && (
                    <span className="ml-2 text-sm font-semibold text-rose-400">
                      − život
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {teams && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {Array.from({ length: 2 }, (_, side) => (
            <div
              key={side}
              className={cn(
                "rounded-2xl bg-black/25 px-4 py-3 text-center ring-1 ring-white/10",
                round.loser === side && "ring-rose-500/60",
              )}
            >
              <p
                className={cn(
                  "truncate text-sm font-bold",
                  sideColor(side).text,
                )}
              >
                {sideName(config, side)}
              </p>
              <p className="font-display text-2xl font-black tabular-nums">
                {roundSidePoints(config, round, side)}
              </p>
            </div>
          ))}
        </div>
      )}

      {withLives && (
        <p className="mt-4 text-center text-base">
          {round.loser == null ? (
            <>Izjednačeno — nitko ne gubi život.</>
          ) : (
            <>
              <b>{sideName(config, round.loser)}</b> ima više bodova i gubi
              život.
            </>
          )}
        </p>
      )}

      {config.mode === "ffa" && (
        <div className="panel mt-4 rounded-2xl p-4">
          <h3 className="mb-2 font-display text-sm font-bold tracking-wider text-muted-foreground uppercase">
            Poredak nakon {roundNumber}. runde
          </h3>
          <ol className="space-y-1.5">
            {standings(config, played, lives).map((st) => (
              <li
                key={st.side}
                className={cn(
                  "flex items-center gap-3 rounded-xl bg-black/25 px-3 py-2 ring-1 ring-white/5",
                  st.place === 1 && "gold-ring",
                )}
              >
                <span className="w-6 font-display font-black text-muted-foreground">
                  {st.place}.
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate font-bold",
                    sideColor(st.side).text,
                  )}
                >
                  {sideName(config, st.side)}
                </span>
                <span className="font-display font-black tabular-nums">
                  {st.total}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Hidden gems */}
      <div className="panel mt-6 rounded-2xl p-5">
        <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold tracking-wider text-gold uppercase">
          <Gem className="size-4" /> Skriveni biseri (odgovori ispod 50 ostaju
          tajna)
        </h3>

        <ul className="grid gap-2 sm:grid-cols-2">
          {gems.map((g, i) => {
            const hide = g.points < 50 && !givenTexts.has(g.text);
            return (
              <li
                key={`${g.text}-${i}`}
                className={cn(
                  "flex items-center justify-between rounded-xl bg-black/25 px-3 py-2 ring-1 ring-white/5",
                  g.points === 0 && "ring-amber-300/40",
                )}
              >
                <span
                  className={cn(
                    "flex items-center gap-1.5 font-semibold",
                    hide && "text-muted-foreground italic",
                  )}
                >
                  {hide && <Lock className="size-3.5 text-gold/70" />}
                  {hide ? "??? (tajni odgovor)" : g.text}
                </span>
                <span
                  className={cn(
                    "font-display font-bold tabular-nums",
                    g.points === 0 ? "text-gold" : "text-neon",
                  )}
                >
                  {g.points}
                </span>
              </li>
            );
          })}
        </ul>

        <button
          onClick={() => setShowAll((s) => !s)}
          className="mt-4 flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
          aria-expanded={showAll}
        >
          {showAll ? "Sakrij" : "Prikaži"} sve odgovore ({q.answers.length})
          <ChevronDown
            className={cn(
              "size-4 transition-transform",
              showAll && "rotate-180",
            )}
          />
        </button>
        {showAll && (
          <ul className="mt-3 space-y-1.5">
            {sorted.map((a) => {
              const idx = q.answers.indexOf(a);
              const hide = a.points < 50 && !given.has(idx);
              return (
                <li key={a.text} className="flex items-center gap-3 text-sm">
                  <span className="w-8 text-right font-display font-bold tabular-nums text-muted-foreground">
                    {a.points}
                  </span>
                  <div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-white/5">
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-lg",
                        a.points === 0 ? "bg-amber-400/40" : "bg-cyan-400/25",
                      )}
                      style={{ width: `${Math.max(a.points, 1.5)}%` }}
                    />
                    <span
                      className={cn(
                        "relative flex h-full items-center gap-1.5 px-2.5 font-medium",
                        given.has(idx) && "font-bold text-gold",
                        hide && "text-muted-foreground italic",
                      )}
                    >
                      {hide && <Lock className="size-3.5 text-gold/70" />}
                      {hide ? "??? (tajni odgovor)" : a.text}
                      {given.has(idx) && " ← odabrano"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-6 flex justify-center">
        <button
          onClick={onNext}
          autoFocus
          className="btn-gold inline-flex h-12 items-center gap-2 rounded-2xl px-7 font-bold"
        >
          {isLast ? "Konačni rezultat" : "Sljedeća runda"}{" "}
          <ArrowRight className="size-5" />
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Ukupno u ovoj rundi:{" "}
        {round.turns
          .map(
            (t) =>
              `${multi ? config.players[t.player] + " " : ""}${t.points} ${bodova(t.points)}`,
          )
          .join(" · ")}
      </p>
    </div>
  );
}

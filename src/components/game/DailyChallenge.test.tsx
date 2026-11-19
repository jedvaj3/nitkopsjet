import { afterEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DailyChallenge } from "./DailyChallenge";

vi.mock("@/game/sound", () => ({
  sfx: { click: vi.fn() },
  unlockAudio: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

test("three attempts reveal the result submission form and daily leaderboard", async () => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: async () => [{ name: "Iva", points: 5, answer: "Odgovor" }],
    }),
  );
  render(<DailyChallenge />);
  expect(await screen.findByText("1. Iva")).toBeInTheDocument();

  for (let i = 0; i < 3; i++) {
    fireEvent.change(screen.getByLabelText(/Tvoj odgovor/), {
      target: { value: `nepostojeći odgovor ${i}` },
    });
    fireEvent.click(screen.getByRole("button", { name: "Potvrdi odgovor" }));
  }

  expect(screen.queryByLabelText(/Tvoj odgovor/)).not.toBeInTheDocument();
  expect(screen.getByText("Najbolji rezultat: 100 bodova")).toBeInTheDocument();
  expect(screen.getByLabelText("Ime za ljestvicu")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Pošalji rezultat" }),
  ).toBeEnabled();
});

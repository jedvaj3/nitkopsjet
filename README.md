# NitkoSjet 🎯

**nitkosjet.fun** — moderna hrvatska web kviz igra po uzoru na TV kvizove u kojima pobjeđuje odgovor kojeg se nitko nije sjetio.

Pitali smo 100 ljudi. Tvoj je zadatak dati **točan** odgovor kojeg se sjetilo **najmanje** njih. Najmanje bodova pobjeđuje, a 0 bodova je jackpot — **NitkoSjet!** Netočan odgovor (ili isteklo vrijeme) donosi 100 kaznenih bodova.

## Značajke

- **40 pitanja** u 8 kategorija (Sport, Geografija, Film i serije, Glazba, Povijest, Znanost i priroda, Hrvatska, Opća kultura) + **Miks**; svako pitanje ima 13–25 točnih odgovora s bodovima 0–100.
- **Solo izazov** — 5 rundi, obori vlastiti rekord.
- **Dvoboj na istom ekranu** — 2 igrača, 3 runde, 2 života; tko u rundi ima više bodova gubi život.
- **Tempo** — opušteno, 30 s ili 15 s po pitanju.
- **Pametna provjera odgovora** — ignorira velika/mala slova i dijakritike (č, ć, ž, š, đ), prihvaća varijante imena, engleske nazive, samo prezime i sitne tipfelere.
- **Animirani stupac bodova** koji se spušta od 100, zvučni efekti generirani Web Audio API-jem i konfeti za NitkoSjet!
- **Pregled runde** sa "skrivenim biserima" (odgovori za 0–5 bodova) i cijelim popisom odgovora.
- **Lokalna ljestvica** (localStorage) i **dijeljenje rezultata** jednim klikom (tekstualni sažetak po rundama).
- Potpuno responzivno — mobitel, tablet, računalo.

## Tehnologije

TanStack Start · React 19 · Tailwind CSS 4 · TypeScript · Web Audio API · Netlify

Igra radi u potpunosti u pregledniku; nema poslužitelja ni baze podataka.

## Lokalno pokretanje

```bash
pnpm install
pnpm dev            # http://localhost:3000
# ili s Netlify emulacijom:
netlify dev
```

## Dodavanje pitanja

Pitanja su u `src/game/questions.ts`. Svaki odgovor je `[tekst, bodovi, ...alternativni nazivi]`. Detaljne smjernice su u `AGENTS.md`.

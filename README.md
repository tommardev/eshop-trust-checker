# E-Shop Trust & Eligibility Checker (Patikima Parduotuvė)

[![Live App](https://img.shields.io/badge/Live%20App-Vercel-000000?logo=vercel&logoColor=white)](https://eshop-trust-checker.vercel.app)
[![Version](https://img.shields.io/static/v1?label=Version&message=v0.1.1&color=1d4ed8)](package.json) <!-- x-release-please-version -->
[![License: AGPL-3.0 + Commercial](https://img.shields.io/badge/License-AGPL--3.0%20%2B%20Commercial-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![GitHub Issues](https://img.shields.io/github/issues/tommardev/eshop-trust-checker)](https://github.com/tommardev/eshop-trust-checker/issues)
[![Last Commit](https://img.shields.io/github/last-commit/tommardev/eshop-trust-checker)](https://github.com/tommardev/eshop-trust-checker/commits/main)

> Automatinis el. parduotuvių ir svetainių patikimumo, saugumo bei teisinės atitikties tikrintuvas, besiremiantis oficialiais Lietuvos ir ES šaltiniais (VVTAT, Registrų Centras, Lietuvos Bankas, WHOIS/DOMREG).

## 🎯 Projekto Idėja ir Tikslas

Vartotojai, ieškodami prekių internete (pvz., perkant auksą, elektroniką, drabužius per socialinius tinklus ar mažai žinomas parduotuves), dažnai susiduria su klausimu:
> *"Ar ši el. parduotuvė yra patikima? Ar joje saugu pirkti? Ar tai nėra fiktyvi svetainė?"*

Šis projektas suteikia patogią vartotojo sąsają, kurioje įvedus svetainės adresą (pvz., `https://kalykla.lt/`) arba pardavėjo pavadinimą, sistema atlieka automatizuotą auditą pagal **VVTAT 5 auksines taisykles** ir kitus oficialius šaltinius.

---

## 🔍 Tikrinimo Šaltiniai ir Kriterijai

### 1. Oficialūs Juodieji Sąrašai ir Blokuojami Tinklalapiai
* **VVTAT blokuojamų domenų sąrašas**: Tikrinimas realiu laiku pagal oficialų VVTAT teismo sprendimu blokuojamų svetainių registrą (`blokuojami.txt`).
* **Lietuvos Banko (LB) nelicencijuotų / įspėjamų subjektų sąrašas**: Itin aktualu investicinio aukso, valiutų keitimo, finansų paslaugų el. parduotuvėms.
* **VVTAT skirtos sankcijos**: Vieši nutarimai dėl nesąžiningos komercinės veiklos ar vartotojų teisių pažeidimų.

### 2. Juridinio Asmens Identifikavimas (Registrų Centras / Rekvizitai)
* **Privalomų rekvizitų buvimas**: Ar svetainėje aiškiai nurodytas įmonės kodas, PVM kodas, registruotos buveinės adresas, telefonas ir el. paštas (VVTAT Taisyklė Nr. 1).
* **Įmonės statuso patikrinimas**: Ar įmonė egzistuoja JAR, ar ji yra veikianti (nėra bankrutuojanti, likviduojama, išregistruota).
* **Veiklos trukmė ir darbuotojų skaičius**: Naujai įsteigta vienadienė įmonė vs. ilgametis rinkos dalyvis.

### 3. Techninis ir Domeno Saugumas
* **Domeno amžius (WHOIS / DOMREG)**: Ar domenas registruotas prieš kelias savaites (aukšta fiktyvios parduotuvės rizika), ar veikia kelerius metus.
* **SSL/TLS Sertifikatas**: Galiojimas, šifravimas, sertifikato išdavėjas.
* **DNS ir serverio geografinė lokacija**: Kur fiziškai talpinama svetainė.

### 4. Vartotojų Teisių Atitiktis ir Teisiniai Reikalavimai
* **14 dienų prekių grąžinimo taisyklės (LR Civilinis kodeksas)**: Ar parduotuvė deklaruoja teisėtą grąžinimo politiką.
* **Apmokėjimo būdai**: Ar siūlomi saugūs atsiskaitymo būdai (Lietuvos bankai, licencijuoti mokėjimo vartai, atsiskaitymas atsiimant prekes), ar tik įtartini tiesioginiai pavedimai į asmeninę sąskaitą.
* **Kalbos kokybė ir automatinis vertimas**: Fiktyvios parduotuvės dažnai naudoja mašininį vertimą su būdingomis gramatikos klaidomis.

---

## 🛠️ Siūlomas Technologinis Stekas

* **Frontend**: Next.js 14+ (App Router), React, Tailwind CSS, TypeScript, Lucide Icons, Shadcn UI.
* **Backend / API**: Next.js API Routes / Node.js mikroservisas:
  * HTML Scraper & Parser (`cheerio` / `playwright` metaduomenų analizei).
  * Domain & SSL Inspector (`tls`, `whois-json` / RDAP).
  * VVTAT & Registry Client (sinchronizuojama duomenų bazė / API adapteriai).
* **Caching & Storage**: SQLite / PostgreSQL / Redis (rezultatų talpinimui, kad pakartotinės užklausos veiktų akimirksniu).

---

## 🚀 Paleidimas ir Vystymas (Getting Started)

### Reikalavimai
- Node.js 22.18+ arba 24 LTS
- npm arba pnpm

### Komandos

```bash
# Įdiegti priklausomybes
npm install

# Paleisti vystymo serverį
npm run dev

# Sukompiliuoti produkcijai
npm run build

# Paleisti produkcijos serverį
npm run start

# Paleisti vienetinius testus
npm test

# Paleisti linterį
npm run lint

# Paleisti TypeScript tipo patikrą (švariai CI patikrai: npx tsc --noEmit --incremental false)
npx tsc --noEmit
```

---

## 🤖 AI Agentic Workflow

- **Coding agents:** [`AGENTS.md`](AGENTS.md)
- **Humans (AI workflow cheat sheet):** [`AI_CODING_README.md`](AI_CODING_README.md)
- **Intros & Tutorials:** [`AI_CODING_LEARN.md`](AI_CODING_LEARN.md)

Naujas komandos narys ar nauja darbo vieta: atkurti agentų įrankius paleidus:
```bash
npx skills experimental_install --yes
```
(Jokiu būdu nepergeneruokite `AGENTS.md` ar komandos taisyklių).

---

## 🤝 Prisidėjimas ir Bendruomenė (Contributing)

Kviečiame prisidėti prie projekto! Prieš pateikdami pakeitimus, susipažinkite su [`CONTRIBUTING.md`](CONTRIBUTING.md), kur aprašyti:
- **Aplinkos reikalavimai:** Node.js `22.18+` ir lokalus paleidimas.
- **Privalomos patikros komandos:** `npm test`, `npx tsc --noEmit --incremental false`, `npm run lint` ir `npm run build`.
- **Darbo eiga ir žinutės:** issue-first procesas (privalomi GitHub Issue ir `Closes #<N>`) bei **Conventional Commits**.

Visi bendruomenės dalyviai privalo laikytis elgesio kodekso, pateikto [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

---

## 🔒 Saugumas (Security)

Pastebėję saugumo spragą, **neatidarykite viešo GitHub Issue**. Apie pažeidžiamumus praneškite privačiai per [GitHub Security Advisories](https://github.com/tommardev/eshop-trust-checker/security/advisories/new) — išsami saugumo politika, palaikomos versijos ir SSRF/scraping ribos aprašytos [`SECURITY.md`](SECURITY.md).

---

## 📄 Licencija (License)

Copyright (c) 2026 tommardev. All rights reserved.

Šis projektas platinamas pagal dvigubos licencijos (**Dual-License**) modelį:

- **Atvirasis kodas:** [**GNU AGPL-3.0-only (Version 3.0 only)**](LICENSE) — laisvam naudojimui, modifikavimui ir savarankiškam talpinimui laikantis GNU Affero General Public License v3.0 only (`AGPL-3.0-only`) sąlygų.
- **Komercinė licencija:** [**Commercial License**](COMMERCIAL_LICENSE.md) — uždarojo kodo ar komerciniam naudojimui už `AGPL-3.0-only` sąlygų ribų (suteikiama atskiru rašytiniu susitarimu).


# E-Shop Trust & Eligibility Checker (Patikima Parduotuvė)

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

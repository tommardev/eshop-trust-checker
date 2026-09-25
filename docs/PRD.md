# Product Requirements Document (PRD)

## Projekto Pavadinimas: E-Shop Trust & Eligibility Checker (`eshop-trust-checker`)
**Versija**: 1.0.0 (MVP)  
**Statusas**: Draft / Planavimas  
**Data**: 2026-09-25  

---

## 1. Problema ir Rinkos Poreikis (Problem & Thesis)

Lietuvos vartotojai kasdien susiduria su didėjančiu sukčiavimo mastu internetinėje erdvėje:
* **Fiktyvios el. parduotuvės socialiniuose tinkluose** (Facebook, Instagram, TikTok reklamos su neįtikėtinomis 80–90% nuolaidomis).
* **Anoniminiai prekeiviai**: svetainėse nėra nurodyti įmonių kodai, buveinių adresai ar telefonai, palikta tik anoniminė kontaktų forma.
* **Finansiniai nuostoliai**: vartotojai sumoka pinigus iš anksto pavedimu arba suveda kortelių duomenis, prekės negauna, o pardavėjas dingsta.
* **Informacijos fragmentacija**: Nors valstybinės institucijos (VVTAT, Lietuvos Bankas, Registrų Centras, CERT-LT) skelbia įspėjimus, vartotojui sudėtinga patiems greitai patikrinti kelis skirtingus registrus, patikrinti domeno amžių ar analizuoti juridinį statusą prieš atliekant pirkimą.

### Vartotojo Klausimas (User Query Archetype):
> *„Ar https://kalykla.lt/ (arba bet kuri kita el. parduotuvė) yra patikima vieta pirkti? Ar yra oficialus šaltinis, kur galima tai patikrinti vienu mygtuko paspaudimu?“*

---

## 2. Hipotezė ir Vertės Pasiūlymas (Hypothesis & Value Proposition)

Jei vartotojui suteiksime vieningą, aiškią, „vieno langelio“ paieškos sistemą, kuri akimirksniu surenka ir išanalizuoja duomenis iš oficialių registrų (VVTAT blokuojamų sąrašo, Registrų Centro JAR, domeno WHOIS amžiaus, SSL sertifikato bei puslapio teisinio atitikimo), vartotojai galės per kelias sekundes priimti pagrįstą sprendimą ir išvengti finansinių nuostolių.

---

## 3. Tiksliniai Vartotojai (Target Users)

1. **Atsargus pirkėjas**: Ketina pirkti brangesnę ar specifinę prekę (investicinį auksą, elektroniką, baldus, prekes vaikams) iš nežinomos el. parduotuvės ir nori įsitikinti pardavėjo teisėtumu.
2. **Socialinių tinklų pirkėjas**: Pamatė patrauklią reklamą socialiniuose tinkluose su didele nuolaida ir nori greitai pasitikrinti, ar tai ne vienadienis sukčių puslapis.
3. **Senjorai ir mažesnio skaitmeninio raštingumo vartotojai**: Reikalingas itin paprastas, vaizdinis atsakymas (Šviesoforo principas: Žalia / Geltona / Raudona) su aiškiu paaiškinimu lietuvių kalba.

---

## 4. MVP Funkcionalumas (Scope & Features)

### 4.1. Įvestis ir Paieška (Search Bar)
* Vartotojas gali įklijuoti:
  * Pilną URL adresą (pvz., `https://kalykla.lt/`, `https://pigu.lt/`, `suspicious-shop.com`).
  * Tik domeną (pvz., `kalykla.lt`).
  * Įmonės pavadinimą arba įmonės kodą.

### 4.2. Automatinis Tikrinimo Variklis (Audit Engine)
1. **Juodųjų sąrašų patikra**:
   * Tikrinimas VVTAT teismo sprendimu blokuojamų domenų bazėje.
   * Tikrinimas Lietuvos Banko nepageidaujamų / neleistinų finansų subjektų sąraše.
2. **Techninis ir Domeno auditas**:
   * SSL/TLS sertifikatas (galioja / negalioja / savadarbis).
   * Domeno amžius (WHOIS/DOMREG): naujas domenas (< 3 mėn.) generuoja įspėjimą.
3. **Puslapio turinio ir rekvizitų nuskaitymas (Scraper)**:
   * Ar randamas 9 skaitmenų įmonės kodas.
   * Ar randamas fizinis buveinės adresas, el. paštas, tel. numeris.
   * Ar randama prekių grąžinimo politika (14 dienų atsisakymo teisė).
4. **Juridinių Asmenų Registro (JAR) patikra**:
   * Įmonės kodo validacija pagal Registrų Centro viešus duomenis.
   * Įmonės statusas (Veikianti / Bankrutuojanti / Likviduojama).

### 4.3. Rezultatų Atvaizdavimas (Trust Report UI)
* **Bendras Patikimumo Įvertinimas (Trust Score 0-100)**:
  * 🟢 **90–100 (Labai patikima)**: Registruota veikianti įmonė, senas domenas, visi kontaktai, jokių pažeidimų.
  * 🟡 **50–89 (Būkite atsargūs / Reikalingas papildomas dėmesys)**: Naujas domenas, trūksta aiškių rekvizitų arba veikia ne ES.
  * 🔴 **0–49 (Aukšta rizika / Nerekomenduojama)**: Įtraukta į VVTAT blokuojamų sąrašą, nėra jokių rekvizitų, įmonė bankrutuojanti arba fiktyvi.
* **Išsamios išklotinės kortelės**:
  * ✅ **Teisinis statusas**: Oficialus įmonės pavadinimas, JAR statusas, PVM mokėtojas.
  * ✅ **Kontaktai**: Rasti kontaktiniai duomenys vs. VVTAT reikalavimai.
  * ✅ **Domenas ir Šifravimas**: Domeno amžius, HTTPS saugumas.
  * ✅ **VVTAT atitiktis**: Nuoroda į oficialias VVTAT rekomendacijas ir patarimai vartotojui.

---

## 5. Ne Tikslai (Non-Goals - MVP etape)

* Nėra siekiama garantuoti 100% teisinio laidavimo (pateikiama teisinė atsakomybės apribojimo išlyga / disclaimer).
* Nėra atliekamas gilus bankinių pavedimų atsekimas.
* Nėra tiesioginio ginčų nagrinėjimo įrankio (vietoj to pateikiama tiesioginė nukreipimo nuoroda į VVTAT skundo formą).

---

## 6. Sėkmės Metrikos (Success Metrics)

* **Tikrinimo greitis**: Pilnas audito atlikimas ir atvaizdavimas < 3 sekundžių.
* **Tikslumas**: Teisingas VVTAT blokuojamų svetainių identifikavimas (100% tikslumas pagal oficialų sąrašą).
* **Vartotojo aiškumas**: Vartotojas per 5 sekundes supranta, ar saugu tęsti pirkimą.

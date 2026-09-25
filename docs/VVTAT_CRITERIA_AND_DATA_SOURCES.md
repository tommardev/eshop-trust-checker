# Oficialūs Šaltiniai, API ir Tikrinimo Kriterijai

Dokumente pateikiama išsami analizė, kaip techniškai įgyvendinti el. parduotuvių patikimumo auditą, remiantis oficialiomis Lietuvos institucijomis, viešaisiais registrais bei saugumo standartais.

---

## 1. VVTAT Kriterijai (5 Auksinės Taisyklės) ir jų Techninis Tikrinimas

Oficialus šaltinis: [VVTAT: Fiktyvios internetinės parduotuvės – kaip atpažinti ir neapsigauti](https://vvtat.lrv.lt/lt/naujienos-ir-pranesimai-ziniasklaidai-377/fiktyvios-internetines-parduotuves-kaip-atpazinti-ir-neapsigauti-977/)

| VVTAT Taisyklė | Reikalavimas | Kaip tikrina sistema (Automatinis Auditas) | Rizikos Lygis |
| :--- | :--- | :--- | :--- |
| **1. Pardavėjo tapatybė** | Buveinės adresas, įmonės kodas, tel. nr., el. paštas svetainėje | Parseris ieško puslapyje (ypač „Kontaktai“, „Apie mus“, porštėje/footer): įmonės kodo (9 skaitmenys), PVM kodo, adreso, el. pašto, telefono. Jei tėra tik anoniminė kontaktų forma arba nėra juridinio asmens rekvizitų – skiriamas kritinis įspėjimas. | **Kritinis (Aukštas)** |
| **2. Įtartinos kainos** | „Per gerai, kad būtų tiesa“ didelės nuolaidos | Heuristika: tikrinama, ar visiems produktams taikoma fiktyvi 70–90% nuolaida (dažnas sukčių bruožas), palyginimas su rinkos vidurkiu (jei integruota kainų paieška). | **Vidutinis** |
| **3. Atsiliepimai** | Tikri vs. fiktyvūs atsiliepimai | Tikrinama ar svetainė turi nuorodas į nepriklausomus atsiliepimų portalus (Trustpilot, Rekvizitai.lt atsiliepimai, Google Reviews). Perspėjama, jei atsiliepimai patalpinti tik kaip statiniai paveikslėliai ar tekstai pačioje svetainėje be autorystės. | **Vidutinis** |
| **4. Mokėjimų saugumas** | SSL sertifikatas, saugūs atsiskaitymo būdai | 1) Tikrinamas galiojantis SSL/TLS sertifikatas (HTTPS). 2) Puslapio kodo analizė: ar integruoti sertifikuoti mokėjimo operatoriai (Paysera, MakeCommerce, Montonio, Neopay, Stripe, Klarna, banklink), ar prašoma daryti tiesioginį pavedimą į privačią fizinio asmens sąskaitą. | **Kritinis** |
| **5. Registracijos šalis** | Trečiųjų šalių pardavėjai (Kinija, JAV, ofšorai) vs. ES | Nustatoma įmonės registracijos jurisdikcija pagal JAR arba WHOIS/hostingą. Vartotojas perspėjamas dėl teisinių teisių gynimo ribojimų, jei pardavėjas veikia ne ES/EEE erdvėje. | **Svarbus** |

---

## 2. Oficialūs Valstybiniai Registrai ir Duomenų Šaltiniai

### A. VVTAT Blokuojamų Svetainių Sąrašas
* **URL**: `https://vvtat.lrv.lt/public/canonical/1790138878/49228/blokuojami.txt`
* **Paskirtis**: Vilniaus apygardos administracinio teismo sprendimu blokuojami domenai dėl šiurkščių ir sistemingų vartotojų teisių pažeidimų.
* **Integracija**: Automatinis periodinis (cron) sąrašo atsisiuntimas ir sinchronizavimas į lokalią duomenų bazę. Įvestas domenas tikrinamas akimirksniu.

### B. Registrų Centras (JAR – Juridinių Asmenų Registras)
* **Šaltinis**: `data.gov.lt` atvirieji duomenys (JAR juridinių asmenų sąrašas ir teisiniai statusai).
* **Paskirtis**:
  * Patikrinti, ar svetainėje nurodytas įmonės kodas egzistuoja.
  * Patikrinti teisinį statusą: `Teisinis statusas: Teisinis statusas neįregistruotas` (veikianti) vs. `Bankrutuojanti`, `Likviduojama`, `Išregistruota`.
  * Patikrinti įmonės įregistravimo datą (kiek metų veikia).

### C. Lietuvos Bankas (LB) Nelicencijuotų / Neleistinos Veiklos Vykdytojų Sąrašas
* **Šaltiniai**:
  * Neleistinos veiklos vykdytojai: `https://www.lb.lt/lt/neleistinos-veiklos-vykdytojai`
  * Finansų rinkos dalyvių registras: `https://www.lb.lt/lt/finansu-rinku-dalyviai`
* **Aktualumas (pvz., kalykla.lt / taurieji metalai / investicijos)**:
  * Tikrinant subjektus, siūlančius auksą, investicijas ar valiutų keitimą, svarbu patikrinti, ar įmonė nėra įtraukta į Lietuvos Banko juoduosius sąrašus, ir ar ji turi reikalingas licencijas/notifikacijas.

### D. Lietuvos Prabavimo Rūmai
* **Aktualumas**: Prekiaujant tauriaisiais metalais (auksu, sidabru, monetomis, luitais) pagal Lietuvos Respublikos tauriųjų metalų ir brangakmenių valstybinės priežiūros įstatymą ūkio subjektai privalo būti įsiregistravę Lietuvos prabavimo rūmuose.
* **Svetainė**: `https://www.lpr.lt` (Ūkio subjektų, vykdančių veiklą su tauriaisiais metalais, sąrašas).

### E. DOMREG (.lt domeno registras) ir WHOIS / RDAP
* **Šaltinis**: `whois.domreg.lt` (RDAP protokolas arba WHOIS užklausos).
* **Ką tikriname**:
  * Domeno sukūrimo data (registracijos data).
  * Sukčių požymis: 95% fiktyvių parduotuvių sukuriamos prieš 1–6 savaites iki atakos pradžios.
  * Domeno būsena (`registered`, `quarantine`, `blocked`).

---

## 3. Pavyzdinė Užklausa: „Ar https://kalykla.lt/ yra patikima vieta pirkti auksą?“

Štai kaip veikia automatinė sistemos patikra šiam pavyzdžiui:

1. **Domeno analizė**:
   * Domenas: `kalykla.lt` (registruotas DOMREG, įkūrimo data sena, domenas stabilus).
   * SSL: Galiojantis EV arba OV/DV šifravimo sertifikatas, nukreipimas į HTTPS.
2. **VVTAT ir sankcijų patikra**:
   * Nėra VVTAT blokuojamų svetainių sąraše.
   * Nėra Lietuvos Banko juoduosiuose sąrašuose.
3. **Pardavėjo rekvizitų atpažinimas**:
   * Svetainėje randamas juridinis asmuo: UAB „Lietuvos monetų kalykla“ (arba oficialus platintojas), įmonės kodas, adresas Eigulių g., Vilnius.
   * JAR statusas: Veikianti valstybės valdoma arba akcinė bendrovė su dešimtmečių istorija.
4. **Specializuota patikra (Taurieji metalai)**:
   * Patikrinama veiklos specifika pagal Lietuvos Prabavimo Rūmų reikalavimus ir Lietuvos Banko numizmatinių vertybių taisykles.
5. **Rezultato pateikimas vartotojui**:
   * **Bendra būsena**: 🟢 **Saugi ir Patikima (Aukštas patikimumo balas: 98/100)**.
   * **Aiški išvada**: Oficialus subjektas, veikiantis legaliai, turintis visus privalomus rekvizitus, ilgametę veiklos istoriją ir neturintis vartotojų teisių pažeidimų įrašų.

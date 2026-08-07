# Player Data Expansion – Height 1.0 audit

Ellenőrzés dátuma: **2026-08-08**  
Szezon: **NB I 2025/26**

## Összesítés

- Egyedi játékos: **440**
- Szezonbeli klubregisztráció: **464**
- Klub: **12**
- Kiinduló `heightCm`: **285 / 440 (64,8%)**
- Új, ellenőrzött személymagasság: **14**
- Végső `heightCm`: **299 / 440 (68,0%)**
- Hiányzó egyedi játékos: **141**
- Érvénytelen magasság: **0**
- Érvényes tartomány: egész szám, **140–220 cm**

A klubonkénti számok regisztrációszintűek. Emiatt a klubváltó játékos ugyanazzal a személymagassággal több klub sorában is szerepelhet. A 14 új személymagasság 15 klubregisztráció lefedettségét javítja, mert Kerezsi Zalán az MTK és a Puskás Akadémia szezonbeli regisztrációjánál is ugyanaz a személy.

## Klub szerinti coverage

| Klub | Játékos | Height előtte | Új adat / regisztráció | Height utána | Hiányzik | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| DVSC | 38 | 27 | 1 | 28 | 10 | 73,7% |
| DVTK | 45 | 33 | 0 | 33 | 12 | 73,3% |
| ETO FC | 35 | 22 | 0 | 22 | 13 | 62,9% |
| Ferencvárosi TC | 42 | 28 | 4 | 32 | 10 | 76,2% |
| Kisvárda Master Good | 38 | 26 | 0 | 26 | 12 | 68,4% |
| Kolorcity Kazincbarcika SC | 40 | 22 | 3 | 25 | 15 | 62,5% |
| MTK Budapest | 36 | 26 | 1 | 27 | 9 | 75,0% |
| Nyíregyháza Spartacus FC | 39 | 26 | 2 | 28 | 11 | 71,8% |
| Paksi FC | 33 | 21 | 0 | 21 | 12 | 63,6% |
| Puskás Akadémia FC | 34 | 21 | 1 | 22 | 12 | 64,7% |
| Újpest FC | 41 | 27 | 3 | 30 | 11 | 73,2% |
| ZTE FC | 43 | 23 | 0 | 23 | 20 | 53,5% |

## Height 1.0 új rekordok

| Klub | Játékos | Magasság | Forrás |
| --- | --- | ---: | --- |
| DVSC | Manzanara Fran | 182 cm | HLSZ |
| Kolorcity Kazincbarcika SC | Prosser Dániel | 175 cm | HLSZ |
| Kolorcity Kazincbarcika SC | Varazdat Haroyan | 185 cm | Transfermarkt – nyilvános játékosprofil |
| Kolorcity Kazincbarcika SC | Blessing Eleke | 190 cm | Transfermarkt – nyilvános játékosprofil |
| Ferencvárosi TC | Cebrail Makreckis | 181 cm | Transfermarkt – nyilvános játékosprofil |
| Ferencvárosi TC | Júlio Romão | 183 cm | Transfermarkt – nyilvános játékosprofil |
| Ferencvárosi TC | Szalai Gábor | 191 cm | Transfermarkt – nyilvános játékosprofil |
| Ferencvárosi TC | Aleksandar Cirkovic | 180 cm | Transfermarkt – nyilvános játékosprofil |
| MTK Budapest | Kerezsi Zalán | 180 cm | Transfermarkt – nyilvános játékosprofil |
| Nyíregyháza Spartacus FC | Temesvári Attila | 200 cm | Transfermarkt – nyilvános játékosprofil |
| Nyíregyháza Spartacus FC | Kersák Roland | 191 cm | Transfermarkt – nyilvános játékosprofil |
| Újpest FC | George Ganea | 180 cm | Transfermarkt – nyilvános játékosprofil |
| Újpest FC | Iuri Medeiros | 174 cm | Transfermarkt – nyilvános játékosprofil |
| Újpest FC | André Duarte | 195 cm | Transfermarkt – nyilvános játékosprofil |

Minden rekord forrás-URL-je, ellenőrzési dátuma, klubja, pontos születési dátuma, aliasa és illesztési oka a `data/club-official-enrichment-26-height-1-reviewed.json` fájlban található.

## Külön kézi ellenőrzési csoportok

### Kisvárda Master Good

A kért 10 korábbi kézi ellenőrzésű rekord: Alic Enes, Balogh Norbert, Gyenge Szilárd, Jordanov Toniszlav, Kovacic Dominik, Matanovics Marko, Melnik Bohdan, Nikolov Boban, Petkovic Danijel, Rubus Tamás.

A végső normalizált adatbázisban **mind a 10 rendelkezik magassággal**. A Height 1.0 egyik meglévő értéket sem írta felül.

### DVSC

Gordic Djordje, Ojediran Hamzat és Oliveira Joao meglévő magassága változatlan maradt. **Manzanara Fran** HLSZ-forrásból, klub + születési dátum + név alapján egyértelműen azonosítva **182 cm** értékkel került be.

### MTK Budapest

Belényesi Csaba és Kosznovszky Márk a végső normalizált adatbázisban rendelkezik magassággal; a Height 1.0 nem írta felül a meglévő értékeket.

## Konfliktus

**VARGA BARNABÁS – Ferencvárosi TC**: a repository jelenlegi születési dátuma `1994-10-25`, a vizsgált HLSZ-profil `1994-01-25` dátumot mutatott. Az eltérés miatt **nem került be automatikus magasság**, a rekord `unresolved-no-height-applied` státuszú.

## Fennmaradó hiányzó magasságok klubonként

A következő lista regisztrációszintű. A klubváltók több klubnál is megjelenhetnek; egyedi hiányzó játékosból **141**, hiányzó klubregisztrációból **147** van.

### DVSC – 10

ASZTALOS NOEL; BODNÁR BALÁZS; EGRI IMRE; ERDÉLYI BENEDEK MIKLÓS; PATAI DÁVID; REGENYEI GERGŐ; Szakál Dénes; Szűcs Tamás; TERCZA GERGŐ; Vajda Botond.

### DVTK – 12

BACSA BENJAMIN SÁNDOR; DEMETER MILÁN; Farkas Ruben Bálint; KISS BÁLINT; KISS LÁSZLÓ; KOVALENKO NAZAR; MACSÓ MÁTÉ; SAJBÁN MÁTÉ MIHÁLY; SZLIFKA ZSOMBOR; TUSKA BÁLINT; VARGA HUNOR ATTILA; VARGA ZÉTÉNY ISTVÁN.

### ETO FC – 13

BÁNÁTI KEVIN; BÍRÓ BARNABÁS; BRECSKA DÁNIEL; HERCZEG MARCELL; KULCSÁR MARTIN; MASCOE LAWRENZO NATHANIEL; SZARKA BULCSÚ JÁNOS; TOLLÁR IMRE ADRIÁN; TÓTH RAJMUND; URBLÍK NORBERT; VINGLER LÁSZLÓ; VITÁLIS MILÁN; KOCSIS BOTOND.

### Ferencvárosi TC – 10

ABU FANI MOHAMMAD; GÓLIK BENJÁMIN JÁNOS; Gróf Dávid Attila; Gruber Zsombor; LAKATOS CSONGOR; LOPES CRUZ CARLOS EDUARDO; MADARÁSZ ÁDÁM; RADNÓTI DÁNIEL ISTVÁN; VARGA BARNABÁS; SZABÓ SZILÁRD.

### Kisvárda Master Good – 12

SZABÓ SZILÁRD; ABDULLAHI KAMAL; ABDULRASAQ RIDWAN POPOOLA; BALOGUN TESLIM ABDULATEEF; JAZSIK ROMÁN; KOLIADA NAZAR; LIPPAI TIBOR; Osztrovka Maxim; PINTÉR ATTILA FILIP; POPOVICS ILLYA; SZIKSZAI HENNAGYIJ; VEPRIK TARASZ.

### Kolorcity Kazincbarcika SC – 15

KOCSIS BOTOND; BALÁZSI LEVENTE KRISTÓF; BÁNFALVI GERGŐ; BOROS ZSOMBOR; FERENCSIK BÁLINT DONÁT; Kártik Bálint József; KUN OLIVÉR; RÁCZ LÁSZLÓ; SCHUSZTER RONALD; SZABÓ MÁTÉ NORBERT; SZŐKE GERGŐ; TRENCSÉNYI BENCE; JUHÁSZ ISTVÁN BENCE; KLAUSZ MILÁN GÁBOR; NYÍRI VINCE TÓBIÁS.

### MTK Budapest – 9

BALÁZS JÓZSEF BALÁZS; GÖRÖG VINCENT; HORVÁTH ARTÚR; KOVÁCS PATRIK; LÁSZLÓ KRISZTIÁN; LEHOCZKY ROLAND PATRIK; MOLNÁR PÉTER; TÖRŐCSIK PÉTER TIBOR; Vasiljevic Andrej.

### Nyíregyháza Spartacus FC – 11

BENCZENLEITNER BARNA; CZIMER-NYITRAI ÁDÁM BÁLINT; FARKAS BENDEGÚZ BENCE; GILBERT DANTAYE MICHAEL LEE; KATONA BÁLINT LAJOS; KOVÁCS MILÁN; MANNER BALÁZS; MOLNÁR MÁTYÁS; Oláh Benjámin; Vukk Zsombor; DALA MARTIN.

### Paksi FC – 12

DEBRECENI ÁKOS; GALAMBOS JÁNOS; GYETVÁN MÁRK; GYURKITS GERGŐ; HINORA KRISTÓF; Horváth Kevin; LAPU ANDOR; MÁTÉ CSABA; Papp Kristóf; Pesti Zoltán; Szekszárdi Milán; VAS GÁBOR.

### Puskás Akadémia FC – 12

DALA MARTIN; Ásványi Domonkos; DUSINSZKI SZABOLCS; KRUPA ZSOLT; Magyar Zsolt János; MONDOVICS KEVIN; NAGY ZOÁRD KORNÉL; OKEKE MICHAEL CHINONSO; ORJÁN ROLAND; SAMAL MOSHE; VARGA ZSOMBOR KOPPÁNY; VÉKONY BENCE ZSOLT.

### Újpest FC – 11

JUHÁSZ ISTVÁN BENCE; FEHÉR CSANÁD LEVENTE; GEIGER BÁLINT; KACZVINSZKI DOMINIK; KOBOURI DAVITI; LISBOA DA SILVA GONCALVES; MÁNDI NARUKI MILÁN; PALKÓ ÁRON; SARKADI KRISTÓF; SZENTKIRÁLYI SZILÁRD; SZENTMIHÁLYI ÁDÁM DÁNIEL.

### ZTE FC – 20

KLAUSZ MILÁN GÁBOR; NYÍRI VINCE TÓBIÁS; AKPE VICTORY MADUABUCHUKWU; BAKTI BALÁZS; BOBSON DIVAIO JHAIR; BORGES DA SILVA DIEGO; DÉNES CSANÁD VILMOS; Garai Zétény Péter; GUNDEL-TAKÁCS BENCE; HARANGI AIDEN JOSHUA; MONTEIRO FERREIRA ANDRÉ; MULASICS DÁNIEL; NÉMETH DÁNIEL; Papp Csongor; PETRÓK VIKTOR; RODRIGUES DA SILVA DIOGO; RÓZSA MÁTÉ; TCHICAMBOUD TRYPHOSE AIMÉ QUEYRELL; VERA GARCIA FERNANDO JOSE; VIEIRA FERREIRA SOUSA JOAO.

## Reprodukálhatóság

A `scripts/audit-player-heights.mjs` újragenerálja és ellenőrzi a coverage-et. Sikertelenül áll le, ha:

- az egyedi játékosszám nem 440;
- a klubregisztrációk száma nem 464;
- a klubok száma nem 12;
- van érvénytelen magasság;
- a coverage 285 ismert magasság alá romlik.

A `scripts/validate-height-enrichment.mjs` külön ellenőrzi a Height 1.0 új rekordjait: pontos klub + születési dátum + normalizált név/alias, egyetlen egyértelmű játékosegyezés, érvényes magasság és visszakövethető forrás szükséges.

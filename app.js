/* Personal site — language toggle, theme toggle and the command bar.
   No build step: this file ships as-is, and is shared by the index and every
   page under projects/. Pages one level down set data-root="../" on <html>. */
(function () {
  "use strict";

  /* Every project with its own page under projects/. Order and group match
     the grid on the index: ops/ first, then ml/. */
  var PROJECTS = [
    { slug: "mushin",          name: "Mushin",          status: "active",       group: "ops" },
    { slug: "goswin",          name: "Goswin",          status: "active",       group: "ops" },
    { slug: "bachelor-thesis", name: "Bachelor Thesis", status: "complete",     group: "ml" },
    { slug: "simurgh",         name: "Simurgh",         status: "complete",     group: "ml" },
    { slug: "zamin",           name: "Zamin",           status: "active",       group: "ml" },
    { slug: "halghe",          name: "Jadid Halghe",    status: "active",       group: "ml" },
    { slug: "tosach",          name: "Tosach",          status: "limbo",        group: "ml" },
    { slug: "stumberg",        name: "Stumberg",        status: "discontinued", group: "ml" },
    { slug: "himantes",        name: "Himantes",        status: "abandoned",    group: "ml" }
  ];

  var STRINGS = {
    en: {
      n1: "whoami", n2: "timeline", n3: "projects", cv: "resume", cvfile: "pdfs/CV4_0.pdf",
      role: "IT support → Linux administration",
      loc: "Europe/Amsterdam · EU citizen",
      hint: "type `help`",
      now: "open to full-time IT support roles · preparing for RHCSA (EX200), exam planned Q1 2027",
      g1: "infrastructure, automation, systems", g2: "study and side projects in machine learning",
      upd: "last updated", updw: "nov 2026",
      bio: "I am not afraid to ask the question and keep digging until I truly understand the why. I like connecting ideas from places that do not naturally meet, but I stay methodical: I want the inner workings, not the surface. Brazilian jiu-jitsu shaped how I work: I keep fighting when things hit the fan and never shy away from getting my hands dirty. I like working close to the machine and keeping real production systems running efficiently and safely, where no news is good news.",
      b1: "work/", b2: "homelab/", b3: "skills/", b4: "education/",
      b5: "certs/", b6: "languages/", b7: "awards/", b8: "other/",
      r1: "Data, Automation & AI Intern", w1: "apr 2026 – may 2026",
      t1: "Built production monitoring for live telecom traffic on self-hosted n8n, using statistical process control to flag anomalies",
      t2: "Automated detection of fraud patterns that led to bans of spammers",
      t3: "Automatically flagged customers with poor call experiences and routed support to them",
      t4: "Replaced manual reporting with scheduled aggregation across internal databases",
      sm: "IT Operations · recommendation letter available", sw: "jun 2024 – aug 2025",
      r2: "Information Security Intern", w2: "jun 2025 – aug 2025",
      s1: "Mapped SOC 2 controls in Vanta and collected supporting evidence across systems",
      s2: "Investigated security incidents, incl. damage control after a malicious insider",
      s6: "Improved internal awareness and support processes around data privacy and security",
      r3: "IT Intern, general IT", w3: "dec 2024 – jun 2025",
      s3: "Owned identity lifecycle in Okta and AccessOwl: daily onboarding, offboarding and access provisioning; automated parts of HR onboarding",
      s7: "Administered Google Workspace, Atlassian and Slack with attention to security; ran quarterly reviews of Slack app integrations",
      s4: "Initiated and led disaster recovery tests; a simulated device-loss scenario exposed a gap that would have cut access to a quarter of managed accounts",
      s8: "Built Slack and Zapier workflow automations that reduced manual work and improved response times",
      s9: "Trained and mentored new interns through their onboarding",
      r4: "IT Support Intern", w4: "jun 2024 – dec 2024",
      s5: "First-line IT support for 1,100 employees across multiple countries: hardware, software, access and network issues, incl. escalated Tier 1 tickets",
      s10: "Reported and escalated high-impact incidents and platform bugs to engineering teams",
      s11: "Set up hardware for new hires, handled asset on/offboarding in Meraki MDM and ran inactive-device audits",
      s12: "Wrote and maintained IT support documentation and the company intranet",
      h0: "3-node Proxmox cluster",
      h1: "Built and clustered Proxmox VE across three bare-metal nodes myself",
      h2: "My practice platform for RHCSA",
      k1: "linux", k2: "virtualisation", k3: "identity", k4: "code",
      km1: "Ubuntu as my daily system",
      km4: "bash (main language, current RHCSA focus), Python",
      e1: "MSc Artificial Intelligence", em1: "AI for Health · VU / UvA", ew1: "2025 – jun 2027 (expected)",
      en1: "Relevant: Medical Informatics Basics, Knowledge Representation",
      en2: "Master project (from November 2026): collapse detection with simulated shadows",
      e2: "BSc Computer Science",
      en3: "Systems coursework: Computer Organization (10/10, incl. an IJVM bytecode interpreter in C), Operating Systems, Computer Networks, Databases",
      en4: "Bachelor thesis: hybrid detection of building collapse after the 2023 earthquake in Antakya",
      cm0: "in preparation", cw0: "exam planned Q1 2027",
      c1: "VLOS UAV operator", c2: "WOPR 2nd Degree Lifeguard",
      l1: "Polish", l2: "English", l3: "German",
      lw1: "native", lw2: "Cambridge CAE, grade A · C2",
      a1: "Go4Poland laureate", am1: "Fundacja GPW · programme for Poles studying abroad",
      o1: "Shop Assistant", ow1: "jan 2024 – jun 2024",
      o2: "Housekeeper", ow2: "jul 2023 – aug 2023",
      o3: "Lifeguard", om3: "Hotel Warmia Park · Pluski, PL", ow3: "jun 2022 – aug 2022",
      entries: "entries",
      /* project one-liners */
      p0: "Bytecode interpreter in C — stack machine and memory management",
      p1: "Agentic AI assistant with tool use and RAG",
      p2: "Chess impossibility recognition with a ResNet-20",
      p3: "ML algorithms written from scratch",
      p4: "RL agents for an agar.io clone",
      p5: "Scene text recognition with a CRNN",
      p6: "n8n workflow automation, kept off GitHub",
      p7: "This very website",
      p8: "Pokémon type classifier and generator",
      p9: "Detecting collapsed buildings with UNET++",
      back: "back to projects"
    },
    pl: {
      n1: "o-mnie", n2: "kariera", n3: "projekty", cv: "cv", cvfile: "pdfs/CV4_0.pdf",
      role: "wsparcie IT → administracja Linuksem",
      loc: "Europe/Amsterdam · obywatel UE",
      hint: "wpisz `help`",
      now: "otwarty na pełny etat w IT support · przygotowuję się do RHCSA (EX200), egzamin planowany w Q1 2027",
      g1: "infrastruktura, automatyzacja, systemy", g2: "projekty z uczenia maszynowego: studia i hobby",
      upd: "ostatnia aktualizacja", updw: "listopad 2026",
      bio: "Nie boję się zadawać pytań i drążę, dopóki naprawdę nie zrozumiem, dlaczego coś działa tak, a nie inaczej. Lubię łączyć pomysły z miejsc, które naturalnie się nie spotykają, ale pozostaję metodyczny: chcę znać mechanizm, a nie tylko powierzchnię. Brazylijskie jiu-jitsu ukształtowało mój sposób pracy: walczę dalej, gdy robi się gorąco, i nie boję się pobrudzić rąk. Lubię pracować blisko maszyny i dbać o to, by prawdziwe systemy produkcyjne działały wydajnie i bezpiecznie — tam, gdzie brak wiadomości to dobra wiadomość.",
      b1: "praca/", b2: "homelab/", b3: "umiejętności/", b4: "edukacja/",
      b5: "certyfikaty/", b6: "języki/", b7: "nagrody/", b8: "inne/",
      r1: "Stażysta ds. danych, automatyzacji i AI", w1: "kwiecień 2026 – maj 2026",
      t1: "Zbudowałem produkcyjny monitoring ruchu telekomunikacyjnego na samodzielnie hostowanym n8n, wykrywający anomalie za pomocą statystycznego sterowania procesem",
      t2: "Zautomatyzowałem wykrywanie wzorców oszustw, co doprowadziło do zablokowania spamerów",
      t3: "Automatycznie oznaczałem klientów ze słabą jakością połączeń i kierowałem do nich wsparcie",
      t4: "Zastąpiłem ręczne raportowanie cykliczną agregacją danych z wewnętrznych baz",
      sm: "IT Operations · dostępny list polecający", sw: "czerwiec 2024 – sierpień 2025",
      r2: "Stażysta ds. bezpieczeństwa informacji", w2: "czerwiec 2025 – sierpień 2025",
      s1: "Mapowałem kontrole SOC 2 w Vanta i zbierałem dowody ich realizacji z różnych systemów",
      s2: "Analizowałem incydenty bezpieczeństwa, m.in. ograniczałem szkody po działaniach złośliwego insidera",
      s6: "Usprawniłem wewnętrzną świadomość i procesy wsparcia w zakresie prywatności danych i bezpieczeństwa",
      r3: "Stażysta IT, ogólne IT", w3: "grudzień 2024 – czerwiec 2025",
      s3: "Odpowiadałem za cykl życia tożsamości w Okta i AccessOwl: codzienny onboarding, offboarding i nadawanie uprawnień; zautomatyzowałem część onboardingu HR",
      s7: "Administrowałem Google Workspace, Atlassianem i Slackiem z naciskiem na bezpieczeństwo; prowadziłem kwartalne przeglądy integracji aplikacji w Slacku",
      s4: "Zainicjowałem i prowadziłem testy odtwarzania po awarii; symulowany scenariusz utraty urządzeń ujawnił lukę, która odcięłaby dostęp do jednej czwartej zarządzanych kont",
      s8: "Zbudowałem automatyzacje w Slacku i Zapierze, które ograniczyły pracę ręczną i skróciły czas reakcji",
      s9: "Szkoliłem nowych stażystów i opiekowałem się nimi podczas wdrożenia",
      r4: "Stażysta wsparcia IT", w4: "czerwiec 2024 – grudzień 2024",
      s5: "Wsparcie IT pierwszej linii dla 1100 pracowników w wielu krajach: sprzęt, oprogramowanie, dostępy i sieć, w tym eskalowane zgłoszenia Tier 1",
      s10: "Zgłaszałem i eskalowałem poważne incydenty oraz błędy platformy do zespołów inżynierskich",
      s11: "Przygotowywałem sprzęt dla nowych pracowników, obsługiwałem on/offboarding urządzeń w Meraki MDM i prowadziłem audyty nieaktywnych urządzeń",
      s12: "Pisałem i utrzymywałem dokumentację wsparcia IT oraz firmowy intranet",
      h0: "Trzywęzłowy klaster Proxmox",
      h1: "Samodzielnie zbudowałem i połączyłem w klaster Proxmox VE na trzech fizycznych węzłach",
      h2: "Moja platforma do ćwiczeń przed RHCSA",
      k1: "linux", k2: "wirtualizacja", k3: "tożsamość", k4: "kod",
      km1: "Ubuntu jako system na co dzień",
      km4: "bash (główny język, obecnie pod RHCSA), Python",
      e1: "Magister sztucznej inteligencji", em1: "AI for Health · VU / UvA", ew1: "2025 – czerwiec 2027 (planowo)",
      en1: "Istotne przedmioty: Medical Informatics Basics, Knowledge Representation",
      en2: "Projekt magisterski (od listopada 2026): wykrywanie zawaleń z użyciem symulowanych cieni",
      e2: "Licencjat z informatyki",
      en3: "Przedmioty systemowe: organizacja komputerów (10/10, w tym interpreter bajtkodu IJVM w C), systemy operacyjne, sieci komputerowe, bazy danych",
      en4: "Praca licencjacka: hybrydowe wykrywanie zawaleń budynków po trzęsieniu ziemi w Antakyi w 2023 r.",
      cm0: "w przygotowaniu", cw0: "egzamin planowany w Q1 2027",
      c1: "Operator BSP (VLOS)", c2: "Ratownik WOPR II stopnia",
      l1: "polski", l2: "angielski", l3: "niemiecki",
      lw1: "ojczysty", lw2: "Cambridge CAE, ocena A · C2",
      a1: "Laureat programu Go4Poland", am1: "Fundacja GPW · program dla Polaków studiujących za granicą",
      o1: "Pracownik sklepu", ow1: "styczeń 2024 – czerwiec 2024",
      o2: "Pracownik obsługi hotelowej", ow2: "lipiec 2023 – sierpień 2023",
      o3: "Ratownik", om3: "Hotel Warmia Park · Pluski", ow3: "czerwiec 2022 – sierpień 2022",
      entries: "pozycji",
      p0: "Interpreter bajtkodu w C — maszyna stosowa i zarządzanie pamięcią",
      p1: "Agentowy asystent AI z użyciem narzędzi i RAG",
      p2: "Rozpoznawanie niemożliwych pozycji szachowych siecią ResNet-20",
      p3: "Algorytmy ML pisane od zera",
      p4: "Agenci RL dla klona agar.io",
      p5: "Rozpoznawanie tekstu w scenach przy pomocy CRNN",
      p6: "Automatyzacje n8n, trzymane poza GitHubem",
      p7: "Ta właśnie strona",
      p8: "Klasyfikator i generator typów Pokémon",
      p9: "Wykrywanie zawalonych budynków siecią UNET++",
      back: "wróć do projektów"
    }
  };

  var SECTIONS = ["whoami", "timeline", "projects"];
  var MAX_OUT_LINES = 40;

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* "" on the index, "../" on a project page. */
  var ROOT = document.documentElement.getAttribute("data-root") || "";

  var langButtons = document.querySelectorAll(".lang");
  var themeButton = document.getElementById("theme-toggle");
  var countEl = document.getElementById("projects-count");
  var cvLink = document.getElementById("cv-link");
  var outEl = document.getElementById("console-out");
  var inputEl = document.getElementById("console-input");

  var lang = STRINGS[store.get("hsk.lang")] ? store.get("hsk.lang") : "en";
  var theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  var out = [];
  var logsGnawed = 0;

  /* Pixel layer hooks (pixel.js). Optional: the site works without it. */
  function px(fn, arg) {
    if (window.HSKPixel && window.HSKPixel[fn]) return window.HSKPixel[fn](arg);
  }

  /* ------------------------------------------------------------- language */

  function applyLang() {
    var t = STRINGS[lang];

    document.documentElement.lang = lang;

    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n]"), function (el) {
      var v = t[el.getAttribute("data-i18n")];
      if (v !== undefined) el.textContent = v;
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n-placeholder]"), function (el) {
      var v = t[el.getAttribute("data-i18n-placeholder")];
      if (v !== undefined) el.placeholder = v;
    });

    if (cvLink && t.cvfile) cvLink.href = ROOT + t.cvfile;

    if (countEl) {
      countEl.textContent =
        document.querySelectorAll("#projects-grid .card").length + " " + t.entries;
    }

    px("face", lang);

    Array.prototype.forEach.call(langButtons, function (b) {
      var on = b.getAttribute("data-lang") === lang;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function setLang(next) {
    if (!STRINGS[next]) return;
    lang = next;
    store.set("hsk.lang", next);
    applyLang();
  }

  /* ---------------------------------------------------------------- theme */

  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    if (themeButton) themeButton.textContent = theme === "dark" ? "[light]" : "[dark]";
    px("theme", theme);
  }

  function toggleTheme() {
    theme = theme === "dark" ? "light" : "dark";
    store.set("hsk.theme", theme);
    applyTheme();
    return theme;
  }

  /* -------------------------------------------------------------- console */

  function render() {
    if (!outEl) return;
    outEl.hidden = out.length === 0;
    outEl.textContent = "";
    out.forEach(function (line) {
      var d = document.createElement("div");
      d.textContent = line;
      outEl.appendChild(d);
    });
    outEl.scrollTop = outEl.scrollHeight;
  }

  function push(echo, lines) {
    out = out.concat(["$ " + echo]).concat(lines).slice(-MAX_OUT_LINES);
    render();
  }

  function goTo(id) {
    var el = document.getElementById(id);
    if (!el) {
      /* Not on this page — jump to the index anchor instead. */
      window.location.href = ROOT + "index.html#" + id;
      return;
    }
    var top = el.getBoundingClientRect().top + window.pageYOffset - 44;
    window.scrollTo({ top: top, behavior: "smooth" });
  }

  function findProject(arg) {
    var q = arg.replace(/\/$/, "");
    for (var i = 0; i < PROJECTS.length; i++) {
      if (PROJECTS[i].slug === q) return PROJECTS[i];
    }
    return null;
  }

  function openCv(line) {
    push(line, ["opening resume.pdf"]);
    window.location.href = ROOT + STRINGS[lang].cvfile;
  }

  function run(raw) {
    var line = raw.trim();
    if (!line) return;

    var parts = line.split(/\s+/);
    var cmd = parts[0].toLowerCase();
    var arg = (parts[1] || "").toLowerCase();

    switch (cmd) {
      case "help":
        push(line, [
          "help  ls [projects]  cd <section>  open <project>  whoami  cv  theme  lang <en|pl>  clear",
          "systemctl status rhcsa  beaver [loud|quiet]",
          "sections: " + SECTIONS.join(", "),
          "open <project> — see `ls projects` for slugs"
        ]);
        break;

      case "ls":
        if (arg === "projects" || arg === "~/projects" || arg === "projects/") {
          var rows = [];
          ["ops", "ml"].forEach(function (g) {
            rows.push(g + "/");
            PROJECTS.forEach(function (p) {
              if (p.group !== g) return;
              rows.push("  " + p.slug + "/" + Array(Math.max(1, 18 - p.slug.length)).join(" ") + p.status);
            });
          });
          push(line, rows);
        } else {
          push(line, [SECTIONS.map(function (s) { return s + "/"; }).join("  ")]);
        }
        break;

      case "cd":
      case "goto":
        if (SECTIONS.indexOf(arg) > -1) {
          goTo(arg);
          push(line, ["-> /" + arg]);
        } else if (findProject(arg)) {
          window.location.href = ROOT + "projects/" + findProject(arg).slug + ".html";
        } else {
          push(line, ["cd: no such section: " + arg]);
        }
        break;

      case "cv":
      case "resume":
        openCv(line);
        break;

      case "systemctl":
        if (arg === "status" && (parts[2] || "").toLowerCase().replace(/\.service$/, "") === "rhcsa") {
          push(line, [
            "● rhcsa.service - Red Hat Certified System Administrator (EX200)",
            "     Loaded: loaded (~/homelab; 3 proxmox nodes)",
            "     Active: active (preparing) — exam planned Q1 2027"
          ]);
        } else {
          push(line, ["usage: systemctl status rhcsa"]);
        }
        break;

      case "open":
      case "cat": {
        if (arg === "resume" || arg === "cv" || arg === "resume.pdf") { openCv(line); break; }
        var p = findProject(arg);
        if (p) {
          window.location.href = ROOT + "projects/" + p.slug + ".html";
        } else {
          push(line, [cmd + ": no such project: " + arg, "try `ls projects`"]);
        }
        break;
      }

      case "whoami":
        push(line, ["hugo sokolowski-katzer", STRINGS[lang].role]);
        break;

      case "theme":
        push(line, ["theme -> " + toggleTheme()]);
        break;

      case "lang":
        if (arg === "en" || arg === "pl") {
          setLang(arg);
          push(line, ["lang -> " + arg]);
        } else {
          push(line, ["usage: lang <en|pl>"]);
        }
        break;

      case "beaver":
        if (arg === "loud" || arg === "quiet") {
          px("mode", arg);
          push(line, ["beaver -> " + arg]);
        } else {
          logsGnawed++;
          px("chew");
          push(line, ["*gnaw gnaw*", "logs gnawed this visit: " + logsGnawed]);
        }
        break;

      case "sudo":
        px("shake");
        push(line, ["hsk is not in the sudoers file. This incident will be reported."]);
        break;

      case "clear":
        out = [];
        render();
        break;

      default:
        px("shake");
        push(line, [cmd + ": command not found"]);
    }
  }

  /* --------------------------------------------------------------- wiring */

  Array.prototype.forEach.call(langButtons, function (b) {
    b.addEventListener("click", function () { setLang(b.getAttribute("data-lang")); });
  });

  if (themeButton) themeButton.addEventListener("click", toggleTheme);

  if (inputEl) {
    inputEl.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") {
        if (e.key.length === 1 || e.key === "Backspace") px("key");
        return;
      }
      run(inputEl.value);
      inputEl.value = "";
    });
  }

  applyLang();
  applyTheme();
  render();
})();

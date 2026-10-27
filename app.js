/* Personal site — language toggle, theme toggle and the command bar.
   No build step: this file ships as-is, and is shared by the index and every
   page under projects/. Pages one level down set data-root="../" on <html>. */
(function () {
  "use strict";

  /* Every project mirrors an entry in content/projects/ on the sister repo
     (github.com/RAGNAROS-HS/Mushin). Order follows Hugo weight, then date. */
  var PROJECTS = [
    { slug: "stumberg",        name: "Stumberg",       status: "discontinued" },
    { slug: "simurgh",         name: "Simurgh",        status: "complete" },
    { slug: "zamin",           name: "Zamin",          status: "active" },
    { slug: "halghe",          name: "Jadid Halghe",   status: "active" },
    { slug: "tosach",          name: "Tosach",         status: "limbo" },
    { slug: "goswin",          name: "Goswin",         status: "active" },
    { slug: "mushin",          name: "Mushin",         status: "active" },
    { slug: "himantes",        name: "Himantes",       status: "abandoned" },
    { slug: "bachelor-thesis", name: "Bachelor Thesis", status: "complete" }
  ];

  var STRINGS = {
    en: {
      n1: "whoami", n2: "timeline", n3: "projects", cv: "resume", cvfile: "pdfs/CV3_0.pdf",
      role: "system administration",
      loc: "Europe/Amsterdam · EU citizen",
      hint: "type `help`",
      bio: "I came to computer science out of broad curiosity about technology, and learned how it actually works inside a company at Swapfiets. Over a year there I moved from IT support to identity management and information security for 1,100 employees. Seeing AI reshape that company led me to an MSc in AI, and at Talk360 I used it to automate everyday operations. Through all of it, what kept drawing me back was the infrastructure underneath. I like working close to the machine and keeping real production systems running efficiently and safely, where no news is good news.",
      b1: "work/", b2: "homelab/", b3: "skills/", b4: "education/",
      b5: "certs/", b6: "languages/", b7: "awards/", b8: "other/",
      r1: "Data, Automation & AI Intern", w1: "apr 2026 – may 2026",
      t1: "Built production monitoring for live telecom traffic on self-hosted n8n, using statistical process control to flag anomalies",
      t2: "Automated detection of fraud patterns that led to bans of spammers",
      t3: "Automated flagging of customers with poor call experiences and routed customer support to them",
      t4: "Replaced manual reporting with scheduled aggregation across internal databases",
      sm: "Amsterdam · contract extended twice", sw: "jun 2024 – aug 2025",
      r2: "Information Security Intern", w2: "jun 2025 – aug 2025",
      s1: "Mapped SOC 2 controls in Vanta and collected supporting evidence across systems",
      s2: "Investigated security incidents, incl. damage control after a malicious insider",
      r3: "IT Intern, general IT", w3: "dec 2024 – jun 2025",
      s3: "Owned identity lifecycle in Okta and AccessOwl; automated parts of HR onboarding",
      s4: "Initiated and led disaster recovery tests; a simulated loss of IT-team devices exposed a gap that would have cut access to a quarter of managed accounts",
      r4: "IT Support Intern", w4: "jun 2024 – dec 2024",
      s5: "Main IT support for 1,100 employees across multiple countries: devices (Meraki MDM), roles and access",
      h0: "3-node Proxmox cluster",
      h1: "Clustered Proxmox VE across three bare-metal nodes",
      h2: "Configured VLANs and DHCP on a MikroTik router to segment the lab network",
      h3: "Run containerised services with Docker across the cluster",
      k1: "systems", k2: "virtualisation", k3: "identity", k4: "code",
      km1: "Linux (Ubuntu), bash, SSH, nginx, reverse proxying, package and service management",
      e1: "MSc Artificial Intelligence", em1: "AI for Health · VU / UvA", ew1: "2025 – jun 2027 (expected)",
      en1: "Coursework: Evolutionary Computing, Knowledge Representation, Brain Imaging, Natural Language Processing, Experimental Design and Data Analysis",
      en2: "Master project (from November 2026): collapse detection with simulated shadows and NN similarity scoring",
      e2: "BSc Computer Science",
      en3: "Systems coursework: Operating Systems, Computer Networks, Computer Organization, Databases",
      en4: "Bachelor thesis: hybrid detection of building collapse after the 2023 earthquake in Antakya",
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
      n1: "o-mnie", n2: "kariera", n3: "projekty", cv: "cv", cvfile: "pdfs/CV3_0.pdf",
      role: "administracja systemami",
      loc: "Europe/Amsterdam · obywatel UE",
      hint: "wpisz `help`",
      bio: "Do informatyki trafiłem z ogólnej ciekawości technologii, a tego, jak naprawdę działa ona wewnątrz firmy, nauczyłem się w Swapfiets. W ciągu roku przeszedłem tam od wsparcia IT do zarządzania tożsamością i bezpieczeństwa informacji dla 1100 pracowników. Obserwując, jak AI zmienia tę firmę, zdecydowałem się na studia magisterskie z AI, a w Talk360 wykorzystałem AI do automatyzacji codziennych operacji. Przez cały ten czas najbardziej przyciągała mnie infrastruktura pod spodem. Lubię pracować blisko maszyny i dbać o to, by prawdziwe systemy produkcyjne działały wydajnie i bezpiecznie — tam, gdzie brak wiadomości to dobra wiadomość.",
      b1: "praca/", b2: "homelab/", b3: "umiejętności/", b4: "edukacja/",
      b5: "certyfikaty/", b6: "języki/", b7: "nagrody/", b8: "inne/",
      r1: "Stażysta ds. danych, automatyzacji i AI", w1: "kwiecień 2026 – maj 2026",
      t1: "Zbudowałem produkcyjny monitoring ruchu telekomunikacyjnego na samodzielnie hostowanym n8n, wykrywający anomalie za pomocą statystycznego sterowania procesem",
      t2: "Zautomatyzowałem wykrywanie wzorców oszustw, co doprowadziło do zablokowania spamerów",
      t3: "Zautomatyzowałem oznaczanie klientów ze słabą jakością połączeń i kierowanie do nich obsługi klienta",
      t4: "Zastąpiłem ręczne raportowanie cykliczną agregacją danych z wewnętrznych baz",
      sm: "Amsterdam · umowa przedłużona dwukrotnie", sw: "czerwiec 2024 – sierpień 2025",
      r2: "Stażysta ds. bezpieczeństwa informacji", w2: "czerwiec 2025 – sierpień 2025",
      s1: "Mapowałem kontrole SOC 2 w Vanta i zbierałem dowody ich realizacji z różnych systemów",
      s2: "Analizowałem incydenty bezpieczeństwa, m.in. ograniczałem szkody po działaniach złośliwego insidera",
      r3: "Stażysta IT, ogólne IT", w3: "grudzień 2024 – czerwiec 2025",
      s3: "Odpowiadałem za cykl życia tożsamości w Okta i AccessOwl; zautomatyzowałem część onboardingu HR",
      s4: "Zainicjowałem i prowadziłem testy odtwarzania po awarii; symulowana utrata urządzeń zespołu IT ujawniła lukę, która odcięłaby dostęp do jednej czwartej zarządzanych kont",
      r4: "Stażysta wsparcia IT", w4: "czerwiec 2024 – grudzień 2024",
      s5: "Główne wsparcie IT dla 1100 pracowników w wielu krajach: urządzenia (Meraki MDM), role i uprawnienia",
      h0: "Trzywęzłowy klaster Proxmox",
      h1: "Klaster Proxmox VE na trzech fizycznych węzłach",
      h2: "Skonfigurowałem VLAN-y i DHCP na routerze MikroTik, segmentując sieć labu",
      h3: "Uruchamiam skonteneryzowane usługi w Dockerze w całym klastrze",
      k1: "systemy", k2: "wirtualizacja", k3: "tożsamość", k4: "kod",
      km1: "Linux (Ubuntu), bash, SSH, nginx, reverse proxy, zarządzanie pakietami i usługami",
      e1: "Magister sztucznej inteligencji", em1: "AI for Health · VU / UvA", ew1: "2025 – czerwiec 2027 (planowo)",
      en1: "Przedmioty: Evolutionary Computing, Knowledge Representation, Brain Imaging, Natural Language Processing, Experimental Design and Data Analysis",
      en2: "Projekt magisterski (od listopada 2026): wykrywanie zawaleń z użyciem symulowanych cieni i oceny podobieństwa siecią neuronową",
      e2: "Licencjat z informatyki",
      en3: "Przedmioty systemowe: systemy operacyjne, sieci komputerowe, organizacja komputerów, bazy danych",
      en4: "Praca licencjacka: hybrydowe wykrywanie zawaleń budynków po trzęsieniu ziemi w Antakyi w 2023 r.",
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

  function run(raw) {
    var line = raw.trim();
    if (!line) return;

    var parts = line.split(/\s+/);
    var cmd = parts[0].toLowerCase();
    var arg = (parts[1] || "").toLowerCase();

    switch (cmd) {
      case "help":
        push(line, [
          "help  ls [projects]  cd <section>  open <project>  whoami  theme  lang <en|pl>  clear",
          "sections: " + SECTIONS.join(", "),
          "open <project> — see `ls projects` for slugs"
        ]);
        break;

      case "ls":
        if (arg === "projects" || arg === "~/projects" || arg === "projects/") {
          push(line, PROJECTS.map(function (p) {
            return p.slug + "/" + Array(Math.max(1, 18 - p.slug.length)).join(" ") + p.status;
          }));
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

      case "open":
      case "cat": {
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

      case "clear":
        out = [];
        render();
        break;

      default:
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
      if (e.key !== "Enter") return;
      run(inputEl.value);
      inputEl.value = "";
    });
  }

  applyLang();
  applyTheme();
  render();
})();

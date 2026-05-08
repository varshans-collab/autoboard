import { firebaseConfig } from "/firebase-config.js";
import { boardStandIds, stands } from "/stands-data.js?v=ai-transparency";

const RECENT_WINDOW_MS = 30 * 60 * 1000;
const DEMO_IMPACT_FLOOR = {
  passengersHelped: 47,
  minutesSaved: 126
};

const waitOptions = [
  { id: "0-5", label: "0-5 min" },
  { id: "5-10", label: "5-10 min" },
  { id: "10-15", label: "10-15 min" },
  { id: "15-plus", label: "15+ min" }
];

const elements = {
  connectionStatus: document.querySelector("#connectionStatus"),
  lastUpdated: document.querySelector("#lastUpdated"),
  routesList: document.querySelector("#routesList"),
  routeChoices: document.querySelector("#routeChoices"),
  waitChoices: document.querySelector("#waitChoices"),
  routeStep: document.querySelector("#routeStep"),
  waitStep: document.querySelector("#waitStep"),
  successStep: document.querySelector("#successStep"),
  selectedRouteLabel: document.querySelector("#selectedRouteLabel"),
  stepPill: document.querySelector("#stepPill"),
  backToRoutes: document.querySelector("#backToRoutes"),
  reportAgain: document.querySelector("#reportAgain"),
  standTitle: document.querySelector("#standTitle"),
  standSubtitle: document.querySelector("#standSubtitle"),
  heroReports: document.querySelector("#heroReports"),
  heroUpdated: document.querySelector("#heroUpdated"),
  heroPulse: document.querySelector("#heroPulse"),
  routesTitle: document.querySelector("#routesTitle"),
  viewAllRoutes: document.querySelector("#viewAllRoutes"),
  loadDemoData: document.querySelector("#loadDemoData"),
  stickyReportButton: document.querySelector("#stickyReportButton"),
  reportPanel: document.querySelector(".report-panel"),
  reportToggleButton: document.querySelector("#reportToggleButton"),
  passengersHelped: document.querySelector("#passengersHelped"),
  timeSaved: document.querySelector("#timeSaved"),
  standDots: document.querySelector("#standDots"),
  reportToast: document.querySelector("#reportToast"),
  reportingNow: document.querySelector("#reportingNow"),
  successTitle: document.querySelector("#successTitle"),
  successText: document.querySelector("#successText"),
  destinationSearch: document.querySelector("#destinationSearch"),
  destinationSuggestions: document.querySelector("#destinationSuggestions"),
  voiceSearchButton: document.querySelector("#voiceSearchButton"),
  destinationHint: document.querySelector("#destinationHint"),
  aiEstimate: document.querySelector("#aiEstimate")
};

let selectedRoute = null;
let db = null;
let usingFirebase = false;
let firebaseApi = null;
let currentRoutes = [];
let showAllRoutes = false;
let previousReportTotal = null;
let previousRouteCounts = new Map();
let toastTimer = null;
let routeFilterValue = "";

const stand = getStandFromPath();

if (!stand) {
  renderUnknownStand();
} else {
  boot();
}

function getStandFromPath() {
  const match = window.location.pathname.match(/^\/stand\/([^/]+)\/?$/);
  const localStand = new URLSearchParams(window.location.search).get("stand");
  const id = (match?.[1] || localStand || "majestic").toLowerCase();
  return stands[id] || null;
}

function boot() {
  document.title = `${stand.name} | AutoBoard`;
  elements.standTitle.textContent = stand.name;
  elements.standSubtitle.textContent = "Never guess your shared auto again.";

  renderRouteChoices();
  renderWaitChoices();
  setupDestinationSearch();
  renderPilotStands();
  renderRoutes(seedBoardState());

  connectFirebase();

  elements.backToRoutes.addEventListener("click", () => showStep("route"));
  elements.reportAgain.addEventListener("click", resetFlow);
  elements.viewAllRoutes.addEventListener("click", toggleRoutesView);
  elements.loadDemoData.addEventListener("click", loadDemoReports);
  elements.reportToggleButton.addEventListener("click", toggleReportPanel);
  elements.stickyReportButton.addEventListener("click", () => {
    expandReportPanel();
    elements.reportPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function setupDestinationSearch() {
  elements.destinationSearch.addEventListener("input", () => {
    routeFilterValue = elements.destinationSearch.value;
    renderRouteChoices();
    renderDestinationSuggestions(elements.destinationSearch.value);
    const exactMatch = findExactDestinationMatch(elements.destinationSearch.value);
    if (exactMatch) {
      selectDestinationFromSearch(exactMatch);
    }
  });

  elements.destinationSearch.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    const match = findBestDestinationMatch(elements.destinationSearch.value) || firstVisibleDestinationMatch();
    if (match) {
      selectDestinationFromSearch(match);
    }
  });

  elements.destinationSearch.addEventListener("focus", () => {
    renderDestinationSuggestions(elements.destinationSearch.value);
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".destination-search")) {
      elements.destinationSuggestions.innerHTML = "";
    }
  });

  setupVoiceSearch();
}

function setupVoiceSearch() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    elements.voiceSearchButton.disabled = true;
    elements.destinationHint.textContent = "Voice search works in Chrome on supported devices";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  elements.voiceSearchButton.addEventListener("click", () => {
    elements.destinationHint.textContent = "Listening for a route...";
    recognition.start();
  });

  recognition.addEventListener("result", (event) => {
    const transcript = event.results[0][0].transcript;
    elements.destinationSearch.value = transcript;
    elements.destinationHint.textContent = `Heard: ${transcript}`;
    routeFilterValue = transcript;
    renderRouteChoices();
    const match = findBestDestinationMatch(transcript);
    if (match) {
      elements.destinationHint.textContent = `${match} selected`;
      elements.destinationSuggestions.innerHTML = "";
      selectRoute(match);
      return;
    }
    renderDestinationSuggestions(transcript);
  });

  recognition.addEventListener("end", () => {
    if (!elements.destinationSearch.value.trim()) {
      elements.destinationHint.textContent = "Tap a route result or press Enter";
    }
  });

  recognition.addEventListener("error", () => {
    elements.destinationHint.textContent = "Voice search could not hear clearly. Try typing.";
  });
}

function renderDestinationSuggestions(query = "") {
  const normalizedQuery = normalizeSearch(query);
  const routeScores = new Map(currentRoutes.map((route) => [route.routeId, route.reportCount]));
  const matches = stand.routes
    .filter((destination) => !normalizedQuery || normalizeSearch(destination).includes(normalizedQuery))
    .sort((a, b) => {
      return (routeScores.get(routeIdFor(b)) || 0) - (routeScores.get(routeIdFor(a)) || 0);
    })
    .slice(0, normalizedQuery ? 8 : 5);

  elements.destinationSuggestions.innerHTML = matches
    .map((destination) => `
      <button type="button" role="option" data-destination="${escapeHtml(destination)}">
        <span>${escapeHtml(destination)}</span>
        <small>Suggested by recent activity</small>
      </button>
    `)
    .join("");

  elements.destinationSuggestions.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const destination = button.dataset.destination;
      selectDestinationFromSearch(destination);
    });
  });
}

function selectDestinationFromSearch(destination) {
  elements.destinationSearch.value = destination;
  routeFilterValue = destination;
  elements.destinationSuggestions.innerHTML = "";
  renderRouteChoices();
  selectRoute(destination);
  elements.reportPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function firstVisibleDestinationMatch() {
  const normalizedQuery = normalizeSearch(elements.destinationSearch.value);
  return stand.routes.find((destination) => !normalizedQuery || normalizeSearch(destination).includes(normalizedQuery)) || null;
}

function findExactDestinationMatch(query = "") {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) {
    return null;
  }

  return stand.routes.find((destination) => normalizeSearch(destination) === normalizedQuery) || null;
}

function findBestDestinationMatch(query = "") {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) {
    return null;
  }

  const aliases = {
    "mejastic": "majestic",
    "market": "krmarket",
    "karmarket": "krmarket",
    "sivajinagar": "shivajinagar",
    "silkbord": "silkboard",
    "electronic": "electroniccity",
    "airport": "kempegowdainternationalairport",
    "brindavancollege": "brindavancollegeofengineering"
  };
  const normalizedTarget = aliases[normalizedQuery] || normalizedQuery;

  return stand.routes.find((destination) => {
    const normalizedDestination = normalizeSearch(destination);
    return normalizedDestination === normalizedTarget || normalizedDestination.includes(normalizedTarget) || normalizedTarget.includes(normalizedDestination);
  }) || null;
}

function normalizeSearch(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

async function connectFirebase() {
  if (!isFirebaseConfigured()) {
    setDemoStatus("Demo");
    return;
  }

  try {
    const appModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const databaseModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js");
    firebaseApi = {
      initializeApp: appModule.initializeApp,
      getDatabase: databaseModule.getDatabase,
      onValue: databaseModule.onValue,
      push: databaseModule.push,
      ref: databaseModule.ref,
      serverTimestamp: databaseModule.serverTimestamp
    };
    const app = firebaseApi.initializeApp(firebaseConfig);
    db = firebaseApi.getDatabase(app);
    usingFirebase = true;
    elements.connectionStatus.textContent = "Live";
    elements.connectionStatus.className = "status-pill is-live";
    listenForRequests();
  } catch (error) {
    console.warn("Firebase is not configured yet. Showing demo state.", error);
    setDemoStatus();
  }
}

function listenForRequests() {
  const requestsRef = firebaseApi.ref(db, `stands/${stand.id}/requests`);
  firebaseApi.onValue(
    requestsRef,
    (snapshot) => {
      const requests = snapshot.exists() ? Object.values(snapshot.val()) : [];
      const boardState = buildBoardState(requests);
      const reportTotal = boardState.reduce((total, route) => total + route.reportCount, 0);
      if (previousReportTotal !== null && reportTotal > previousReportTotal) {
        const changedRoute = findIncreasedRoute(boardState);
        showReportToast(reportTotal - previousReportTotal, changedRoute?.destination);
      }
      previousReportTotal = reportTotal;
      previousRouteCounts = new Map(boardState.map((route) => [route.routeId, route.reportCount]));
      renderRoutes(boardState);
      elements.lastUpdated.textContent = requests.length ? "Updated now" : "Demo";
      if (!requests.length) {
        elements.connectionStatus.textContent = "Live demo";
        elements.connectionStatus.className = "status-pill is-demo";
      } else {
        elements.connectionStatus.textContent = "Live";
        elements.connectionStatus.className = "status-pill is-live";
      }
    },
    (error) => {
      console.error("Realtime Database read failed.", error);
      setDemoStatus();
      renderRoutes(seedBoardState());
    }
  );
}

function buildBoardState(requests) {
  const cutoff = Date.now() - RECENT_WINDOW_MS;
  const recentRequests = requests.filter((request) => {
    const timestamp = Number(request.timestamp);
    return request.standId === stand.id && Number.isFinite(timestamp) && timestamp >= cutoff;
  });

  if (!recentRequests.length) {
    return seedBoardState();
  }

  const destinationSet = new Set(stand.routes);
  recentRequests.forEach((request) => {
    if (request.destination) {
      destinationSet.add(request.destination);
    }
  });

  return [...destinationSet].map((destination) => {
    const routeId = routeIdFor(destination);
    const routeReports = recentRequests
      .filter((request) => request.routeId === routeId)
      .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
    const latest = routeReports[0];
    const waitEstimate = estimateWaitMinutes(routeReports.map((request) => request.waitTime));

    return {
      routeId,
      origin: stand.name,
      destination,
      waitTime: latest?.waitTime || "No recent reports",
      aiWaitEstimate: waitEstimate,
      reportCount: routeReports.length,
      lastReportAt: latest?.timestamp || null,
      pulseCount: routeReports.filter((request) => Number(request.timestamp) >= Date.now() - 2 * 60 * 1000).length,
      isDemo: false
    };
  });
}

function seedBoardState() {
  const demoPattern = [
    { waitTime: "5-10 min", reportCount: 8, ageSeconds: 30, pulseCount: 3 },
    { waitTime: "10-15 min", reportCount: 6, ageSeconds: 45, pulseCount: 1 },
    { waitTime: "0-5 min", reportCount: 5, ageSeconds: 70, pulseCount: 0 },
    { waitTime: "15+ min", reportCount: 4, ageSeconds: 95, pulseCount: 0 },
    { waitTime: "5-10 min", reportCount: 3, ageSeconds: 130, pulseCount: 0 },
    { waitTime: "10-15 min", reportCount: 2, ageSeconds: 180, pulseCount: 0 },
    { waitTime: "0-5 min", reportCount: 1, ageSeconds: 240, pulseCount: 0 },
    { waitTime: "No recent reports", reportCount: 0, ageSeconds: null, pulseCount: 0 }
  ];

  return stand.routes.map((destination, index) => {
    const demo = demoPattern[index] || demoPattern[demoPattern.length - 1];
    return {
      routeId: routeIdFor(destination),
      origin: stand.name,
      destination,
      waitTime: demo.waitTime,
      aiWaitEstimate: estimateWaitMinutes([demo.waitTime]),
      reportCount: demo.reportCount,
      lastReportAt: demo.ageSeconds === null ? null : Date.now() - demo.ageSeconds * 1000,
      pulseCount: demo.pulseCount,
      isDemo: true
    };
  });
}

function renderRoutes(routes) {
  currentRoutes = [...routes].sort((a, b) => {
    if (b.reportCount !== a.reportCount) {
      return b.reportCount - a.reportCount;
    }
    return Number(b.lastReportAt || 0) - Number(a.lastReportAt || 0);
  });
  renderHeroStats(currentRoutes);
  renderAiSummary(currentRoutes);
  updateRouteChoiceStats();

  elements.routesList.innerHTML = "";
  const visibleRoutes = showAllRoutes ? currentRoutes : currentRoutes.slice(0, 3);
  elements.routesTitle.textContent = showAllRoutes ? "All routes" : "Popular right now";
  elements.viewAllRoutes.hidden = currentRoutes.length <= 3;
  elements.viewAllRoutes.textContent = showAllRoutes ? "Show popular routes" : "View all routes";

  visibleRoutes.forEach((route) => {
    const routeCard = document.createElement("article");
    routeCard.className = `route-card${route.reportCount ? "" : " is-empty"}`;

    const lastSeen = route.lastReportAt ? `Updated ${formatAgo(Date.now() - Number(route.lastReportAt))}` : "No update in 30 min";
    const reportLabel = route.reportCount === 1 ? "1 report" : `${route.reportCount} reports`;
    const waitLabel = route.reportCount ? route.waitTime : "Quiet";
    const aiLabel = route.reportCount && route.aiWaitEstimate
      ? `AI ~${route.aiWaitEstimate} min based on ${route.reportCount} recent ${route.reportCount === 1 ? "report" : "reports"}`
      : "No AI estimate yet";
    const activityLabel = route.pulseCount
      ? "⚡ Just reported"
      : route.reportCount >= 5
        ? "🔥 Trending"
        : route.reportCount > 0
          ? "● Active now"
          : "";

    routeCard.innerHTML = `
      <div class="route-main">
        <div>
          <h3 class="route-name">
            ${escapeHtml(route.destination)}
            ${activityLabel ? `<span class="activity-tag">${escapeHtml(activityLabel)}</span>` : ""}
          </h3>
          <p class="route-meta-line">${route.reportCount ? "Live now &middot; " : "Quiet &middot; "}${escapeHtml(reportLabel)} &middot; ${escapeHtml(lastSeen)}</p>
          <p class="ai-route-line">${escapeHtml(aiLabel)}</p>
        </div>
        <span class="wait-badge">${escapeHtml(waitLabel)}</span>
      </div>
    `;

    elements.routesList.append(routeCard);
  });
}

function renderAiSummary(routes) {
  const activeRoutes = routes.filter((route) => route.reportCount && route.aiWaitEstimate);
  if (!activeRoutes.length) {
    elements.aiEstimate.textContent = "No recent passenger reports yet. Demo data can show how the estimate works.";
    return;
  }

  const topRoute = activeRoutes[0];
  elements.aiEstimate.textContent = `For ${topRoute.destination}, AI estimates about ${topRoute.aiWaitEstimate} min based on ${topRoute.reportCount} passenger ${topRoute.reportCount === 1 ? "report" : "reports"} from the last 30 minutes.`;
}

function estimateWaitMinutes(waitTimes) {
  const numericWaits = waitTimes
    .map(waitTimeToMinutes)
    .filter((minutes) => Number.isFinite(minutes));

  if (!numericWaits.length) {
    return null;
  }

  const total = numericWaits.reduce((sum, minutes, index) => {
    const recencyWeight = Math.max(1, numericWaits.length - index);
    return sum + minutes * recencyWeight;
  }, 0);
  const weightTotal = numericWaits.reduce((sum, _minutes, index) => sum + Math.max(1, numericWaits.length - index), 0);

  return Math.round(total / weightTotal);
}

function waitTimeToMinutes(waitTime = "") {
  if (waitTime.includes("0-5")) return 3;
  if (waitTime.includes("5-10")) return 8;
  if (waitTime.includes("10-15")) return 13;
  if (waitTime.includes("15+")) return 18;
  return NaN;
}

async function loadDemoReports() {
  const demoRoutes = stand.routes.slice(0, 4);
  const demoWaits = ["5-10 min", "5-10 min", "10-15 min", "0-5 min"];

  if (!usingFirebase || !db) {
    renderRoutes(seedBoardState());
    showReportToast(3, demoRoutes[0]);
    return;
  }

  elements.loadDemoData.disabled = true;
  elements.loadDemoData.textContent = "Loading...";

  try {
    await Promise.all(demoRoutes.map((destination, index) => {
      const request = {
        standId: stand.id,
        standName: stand.name,
        routeId: routeIdFor(destination),
        origin: stand.name,
        destination,
        waitTime: demoWaits[index] || "5-10 min",
        timestamp: Date.now() - index * 45 * 1000
      };
      return firebaseApi.push(firebaseApi.ref(db, `stands/${stand.id}/requests`), request);
    }));
    showReportToast(demoRoutes.length, demoRoutes[0]);
  } catch (error) {
    console.error("Could not load demo data.", error);
    alert("Could not load demo data. Please try again.");
  } finally {
    elements.loadDemoData.disabled = false;
    elements.loadDemoData.textContent = "Load demo data";
  }
}

function renderHeroStats(routes) {
  const totalReports = routes.reduce((total, route) => total + route.reportCount, 0);
  const latestTimestamp = routes.reduce((latest, route) => Math.max(latest, Number(route.lastReportAt || 0)), 0);
  const pulseCount = routes.reduce((total, route) => total + Number(route.pulseCount || 0), 0);
  const passengersHelped = Math.max(totalReports, DEMO_IMPACT_FLOOR.passengersHelped);
  const minutesSaved = Math.max(totalReports * 2, DEMO_IMPACT_FLOOR.minutesSaved);

  elements.heroReports.textContent = totalReports === 1 ? "1 report" : `${totalReports} reports`;
  elements.heroUpdated.textContent = latestTimestamp ? `Updated ${formatAgo(Date.now() - latestTimestamp)}` : "Updated now";
  elements.passengersHelped.textContent = String(passengersHelped);
  elements.timeSaved.textContent = `${minutesSaved} min`;
  elements.heroPulse.textContent = pulseCount
    ? `${pulseCount} autos reported in the last 2 mins`
    : "Live reports refresh every few seconds";
  elements.reportingNow.textContent = pulseCount
    ? `${Math.max(2, pulseCount)} passengers reporting now`
    : "2 passengers reporting now";
}

function toggleRoutesView() {
  showAllRoutes = !showAllRoutes;
  renderRoutes(currentRoutes);
}

function findIncreasedRoute(routes) {
  return routes.find((route) => route.reportCount > (previousRouteCounts.get(route.routeId) || 0));
}

function renderPilotStands() {
  elements.standDots.innerHTML = boardStandIds
    .filter((standId) => stands[standId])
    .map((standId) => {
      const knownStand = stands[standId];
      const isCurrent = knownStand.id === stand.id;
      return `<span class="${isCurrent ? "is-current" : ""}">${escapeHtml(knownStand.name)}</span>`;
    })
    .join("");
}

function showReportToast(count = 1, destination = "") {
  if (destination) {
    elements.reportToast.textContent = count === 1
      ? `⚡ New auto to ${destination} reported just now`
      : `⚡ ${count} new autos reported just now`;
  } else {
    elements.reportToast.textContent = count === 1 ? "⚡ New route reported just now" : `⚡ ${count} new autos reported just now`;
  }
  elements.reportToast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    elements.reportToast.classList.remove("is-visible");
  }, 2200);
}

function renderRouteChoices() {
  elements.routeChoices.innerHTML = "";
  const normalizedFilter = normalizeSearch(routeFilterValue);
  const filteredRoutes = stand.routes.filter((destination) => {
    return !normalizedFilter || normalizeSearch(destination).includes(normalizedFilter);
  });
  const visibleRoutes = normalizedFilter ? filteredRoutes.slice(0, 10) : filteredRoutes.slice(0, 8);

  if (!filteredRoutes.length) {
    elements.routeChoices.innerHTML = `
      <div class="empty-routes">
        No listed route matches. Try a nearby name or choose the closest route.
      </div>
    `;
    return;
  }

  visibleRoutes.forEach((destination) => {
    const routeId = routeIdFor(destination);
    const button = document.createElement("button");
    button.className = "choice-button";
    button.type = "button";
    button.dataset.routeId = routeId;
    button.innerHTML = `
      <span class="choice-main">
        <span class="choice-pin" aria-hidden="true"></span>
        <span>${escapeHtml(destination)}</span>
      </span>
      <span class="choice-meta">Live route</span>
    `;
    button.addEventListener("click", () => {
      selectRoute(destination);
    });
    elements.routeChoices.append(button);
  });
  updateRouteChoiceStats();
}

function selectRoute(destination) {
  expandReportPanel();
  const routeId = routeIdFor(destination);
  selectedRoute = {
    routeId,
    origin: stand.name,
    destination
  };
  markSelectedRoute(routeId);
  elements.selectedRouteLabel.textContent = `${destination} selected`;
  showStep("wait");
}

function updateRouteChoiceStats() {
  if (!elements.routeChoices.children.length || !currentRoutes.length) {
    return;
  }

  currentRoutes.forEach((route) => {
    const button = elements.routeChoices.querySelector(`[data-route-id="${route.routeId}"]`);
    if (!button) {
      return;
    }
    const meta = button.querySelector(".choice-meta");
    const reportText = route.reportCount === 1 ? "1 passenger recently" : `${route.reportCount} passengers recently`;
    meta.textContent = route.reportCount ? reportText : "Quiet right now";
  });
}

function markSelectedRoute(routeId) {
  elements.routeChoices.querySelectorAll(".choice-button").forEach((button) => {
    const isSelected = button.dataset.routeId === routeId;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
}

function renderWaitChoices() {
  elements.waitChoices.innerHTML = "";
  waitOptions.forEach((wait) => {
    const button = document.createElement("button");
    button.className = "choice-button";
    button.type = "button";
    button.textContent = wait.label;
    button.addEventListener("click", () => submitRequest(wait.label));
    elements.waitChoices.append(button);
  });
}

async function submitRequest(waitTime) {
  if (!selectedRoute) {
    showStep("route");
    return;
  }

  if (!usingFirebase || !db) {
    setDemoStatus("Config needed");
    alert("Add your Firebase config in firebase-config.js before submitting live updates.");
    return;
  }

  const request = {
    standId: stand.id,
    standName: stand.name,
    routeId: selectedRoute.routeId,
    origin: selectedRoute.origin,
    destination: selectedRoute.destination,
    waitTime,
    timestamp: firebaseApi.serverTimestamp()
  };

  try {
    await firebaseApi.push(firebaseApi.ref(db, `stands/${stand.id}/requests`), request);
    elements.successTitle.textContent = "Report added";
    elements.successText.textContent = `You helped ${DEMO_IMPACT_FLOOR.passengersHelped} Bengaluru passengers see this update.`;
    showStep("success");
  } catch (error) {
    console.error("Could not submit passenger update.", error);
    alert("Could not submit right now. Please try again.");
  }
}

function isFirebaseConfigured() {
  return firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("PASTE_YOUR");
}

function showStep(step) {
  expandReportPanel();
  elements.routeStep.classList.toggle("is-active", step === "route");
  elements.waitStep.classList.toggle("is-active", step === "wait");
  elements.successStep.classList.toggle("is-active", step === "success");

  if (step === "route") {
    elements.stepPill.textContent = "Step 1: Where are you going?";
  } else if (step === "wait") {
    elements.stepPill.textContent = "Step 2: How long did you wait?";
  } else {
    elements.stepPill.textContent = "Report added";
  }
  elements.stickyReportButton.classList.toggle("is-hidden", step !== "route");
}

function resetFlow() {
  selectedRoute = null;
  markSelectedRoute("");
  showStep("route");
}

function toggleReportPanel() {
  elements.reportPanel.classList.toggle("is-collapsed");
  elements.reportToggleButton.textContent = elements.reportPanel.classList.contains("is-collapsed") ? "Open" : "Close";
}

function expandReportPanel() {
  elements.reportPanel.classList.remove("is-collapsed");
  elements.reportToggleButton.textContent = "Close";
}

function routeIdFor(destination) {
  return destination
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatAgo(ageMs) {
  if (ageMs < 60000) {
    const seconds = Math.max(10, Math.round(ageMs / 1000));
    return `${seconds} sec ago`;
  }
  const minutes = Math.max(1, Math.round(ageMs / 60000));
  if (minutes >= 30) {
    return "30 min ago";
  }
  return `${minutes} min ago`;
}

function setDemoStatus(label = "Demo") {
  elements.connectionStatus.textContent = label;
  elements.connectionStatus.className = "status-pill is-demo";
  elements.lastUpdated.textContent = "Demo routes";
}

function renderUnknownStand() {
  elements.connectionStatus.textContent = "Stand needed";
  elements.connectionStatus.className = "status-pill is-demo";
  elements.standTitle.textContent = "Choose a board stand";
  elements.standSubtitle.textContent = "Open AutoBoard from one of the stand QR links.";
  const standLinks = boardStandIds
    .map((standId) => stands[standId])
    .filter(Boolean)
    .map((knownStand) => `<p><a href="/stand/${knownStand.id}">/stand/${knownStand.id}</a></p>`)
    .join("");

  elements.routesList.innerHTML = `
    <div class="unknown-stand">
      <p>Use one of these stand URLs:</p>
      ${standLinks}
    </div>
  `;
  elements.routeChoices.innerHTML = "";
  elements.waitChoices.innerHTML = "";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

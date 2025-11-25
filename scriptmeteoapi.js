/* ============================
   CLÉS & CONSTANTES
   ============================ */
// Clé API OpenWeatherMap
const OPENWEATHER_API_KEY = "74477f24ec377dbaff9cf6655557f728";

// Limite pour l'autocomplétion (nombre de propositions)
const GEO_LIMIT = 5;

// Clés utilisées pour le stockage local
const STORAGE_KEYS = {
  SAVED: "meteo_saved_cities_v1", // villes sauvegardées
  THEME: "meteo_theme_v1", // thème clair/sombre
  LAST_CITY: "meteo_last_city_v1", // dernière ville consultée
};

/* ============================
   ELEMENTS DU DOM
   ============================ */
const el = {
  input: document.getElementById("searchInput"), // champ de recherche
  btnSearch: document.getElementById("searchBtn"), // bouton rechercher
  btnGeo: document.getElementById("geoBtn"), // bouton géolocalisation
  suggestions: document.getElementById("suggestions"), // liste autocomplétion
  loader: null, // loader (sera créé si absent)
  cityName: document.getElementById("cityName"), // nom de la ville
  localTime: document.getElementById("localTime"), // heure locale
  weatherIcon: document.getElementById("weatherIcon"), // icône météo
  temperature: document.getElementById("temperature"), // température
  humidity: document.getElementById("humidity"), // humidité
  wind: document.getElementById("wind"), // vent
  forecastContainer: document.getElementById("forecast"), // conteneur prévisions
  savedCitiesDiv: document.getElementById("savedCities"), // conteneur villes sauvegardées
  themeToggle: document.getElementById("theme-toggle"), // bouton toggle thème
  body: document.body,
};

/* ============================
   CREATION DU LOADER
   ============================ */
(function ensureLoader() {
  let ld = document.getElementById("loader");
  if (!ld) {
    ld = document.createElement("div");
    ld.id = "loader";
    ld.textContent = "🔄 Chargement...";
    ld.style.display = "none";
    ld.style.textAlign = "center";
    ld.style.margin = "12px 0";
    ld.style.fontSize = "18px";
    ld.style.color = "#fff";
    document
      .querySelector(".app")
      .insertBefore(ld, document.querySelector(".weather-card"));
  }
  el.loader = ld;
})();

/* ============================
   FONCTIONS UTILITAIRES (helpers)
   ============================ */

function showLoader() {
  el.loader.style.display = "block";
}

function hideLoader() {
  el.loader.style.display = "none";
}

function formatTemp(kelvinOrC, isKelvin = true) {
  if (isKelvin) {
    const c = Math.round(kelvinOrC - 273.15);
    return `${c}°C`;
  } else {
    return `${Math.round(kelvinOrC)}°C`;
  }
}

function msToKmh(ms) {
  if (ms === null || ms === undefined) return "—";
  return `${Math.round(ms * 3.6)} km/h`;
}

function formatLocalTime(dtUnix, timezoneOffsetSeconds) {
  const localMillis = (dtUnix + timezoneOffsetSeconds) * 1000;
  const d = new Date(localMillis);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function weatherCategory(main) {
  if (!main) return "cloudy";
  const m = main.toLowerCase();
  if (m.includes("clear")) return "sunny";
  if (m.includes("rain") || m.includes("drizzle")) return "rainy";
  if (m.includes("thunder") || m.includes("storm")) return "stormy";
  if (m.includes("cloud")) return "cloudy";
  if (m.includes("snow")) return "cloudy";
  return "cloudy";
}

/* ============================
   STOCKAGE LOCAL : VILLES ENREGISTRÉES
   ============================ */

function loadSavedCities() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Erreur lors de la lecture des villes sauvegardées", e);
    return [];
  }
}

function saveSavedCities(list) {
  localStorage.setItem(STORAGE_KEYS.SAVED, JSON.stringify(list));
}

function addSavedCity(obj) {
  if (!obj || !obj.name) return;
  const list = loadSavedCities();
  const exists = list.find(
    (c) =>
      (c.lat === obj.lat && c.lon === obj.lon) ||
      c.name.toLowerCase() === obj.name.toLowerCase()
  );
  if (!exists) {
    list.unshift(obj);
    if (list.length > 8) list.pop();
    saveSavedCities(list);
    renderSavedCities();
  }
}

/* ============================
   GESTION DU THÈME (clair / sombre)
   ============================ */

function loadTheme() {
  const t = localStorage.getItem(STORAGE_KEYS.THEME);
  if (t === "dark") {
    el.body.classList.add("dark");
  } else {
    el.body.classList.remove("dark");
  }
  updateThemeToggleIcon();
}

function toggleTheme() {
  el.body.classList.toggle("dark");
  localStorage.setItem(
    STORAGE_KEYS.THEME,
    el.body.classList.contains("dark") ? "dark" : "light"
  );
  updateThemeToggleIcon();
}

function updateThemeToggleIcon() {
  if (el.themeToggle)
    el.themeToggle.textContent = el.body.classList.contains("dark")
      ? "☀️"
      : "🌙";
}

/* ============================
   AUTOCOMPLÉTION
   ============================ */

let autocompleteAbortController = null;
let debounceTimer;

function fetchSuggestions(query) {
  clearTimeout(debounceTimer);
  if (query.length < 2) {
    el.suggestions.style.display = "none";
    return;
  }

  debounceTimer = setTimeout(async () => {
    const saved = loadSavedCities()
      .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 3);

    if (saved.length > 0) {
      renderSuggestions(
        saved.map((s) => ({
          name: s.name,
          lat: s.lat,
          lon: s.lon,
          country: s.country,
        }))
      );
    }

    if (!OPENWEATHER_API_KEY) return;

    if (autocompleteAbortController) autocompleteAbortController.abort();
    autocompleteAbortController = new AbortController();

    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
      query
    )}&limit=${GEO_LIMIT}&appid=${OPENWEATHER_API_KEY}`;

    try {
      const res = await fetch(url, {
        signal: autocompleteAbortController.signal,
      });
      if (!res.ok) return;
      const data = await res.json();
      const items = data.map((it) => ({
        name: `${it.name}${it.state ? ", " + it.state : ""}, ${it.country}`,
        lat: it.lat,
        lon: it.lon,
      }));
      renderSuggestions(items);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("Erreur autocomplétion", err);
    }
  }, 300);
}

function renderSuggestions(list) {
  el.suggestions.innerHTML = "";
  if (!list || list.length === 0) {
    el.suggestions.style.display = "none";
    return;
  }
  el.suggestions.style.display = "block";
  list.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item.name;
    li.style.cursor = "pointer";
    li.style.padding = "10px";
    li.style.borderBottom = "1px solid #ccc";
    li.style.backgroundColor = "rgba(255,255,255,0.9)";
    li.style.color = "#333";

    li.addEventListener("click", () => {
      el.input.value = item.name;
      el.suggestions.style.display = "none";
      if (item.lat && item.lon) {
        getWeatherByCoords(item.lat, item.lon, item.name);
      } else {
        getWeather(item.name);
      }
    });

    el.suggestions.appendChild(li);
  });
}

/* ============================
   AFFICHAGE VILLES SAUVEGARDÉES
   ============================ */
function renderSavedCities() {
  const list = loadSavedCities();
  el.savedCitiesDiv.innerHTML = "";
  if (list.length === 0) {
    el.savedCitiesDiv.innerHTML =
      '<p style="opacity:0.85">Aucune ville sauvegardée.</p>';
    return;
  }
  list.forEach((c) => {
    const btn = document.createElement("button");
    btn.textContent = c.name;
    btn.title = `${c.name} — cliquer pour charger`;
    btn.addEventListener("click", () =>
      getWeatherByCoords(c.lat, c.lon, c.name)
    );
    el.savedCitiesDiv.appendChild(btn);
  });
}

/* ============================
   PRÉVISIONS SUR 5 JOURS
   ============================ */
function renderForecast(forecastData) {
  if (!forecastData || !forecastData.list) {
    el.forecastContainer.innerHTML =
      "<p>Données de prévision non disponibles</p>";
    return;
  }

  // Grouper par jour
  const dailyForecasts = {};
  forecastData.list.forEach((item) => {
    const date = new Date(item.dt * 1000);
    const dayKey = date.toDateString();

    if (!dailyForecasts[dayKey]) {
      dailyForecasts[dayKey] = {
        date: date,
        items: [],
      };
    }
    dailyForecasts[dayKey].items.push(item);
  });

  // Prendre les 5 premiers jours
  const days = Object.values(dailyForecasts).slice(0, 5);

  el.forecastContainer.innerHTML = "";

  days.forEach((day) => {
    // Prendre la prévision de midi ou la première disponible
    const forecast =
      day.items[Math.floor(day.items.length / 2)] || day.items[0];
    const weather = forecast.weather[0];

    const dayElement = document.createElement("div");
    dayElement.className = "day";
    dayElement.innerHTML = `
      <h4>${day.date.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "short",
      })}</h4>
      <img src="https://openweathermap.org/img/wn/${weather.icon}.png" alt="${
      weather.description
    }">
      <p>${formatTemp(forecast.main.temp)}</p>
      <p>${weather.description}</p>
      <p><small>Humidité: ${forecast.main.humidity}%</small></p>
    `;

    el.forecastContainer.appendChild(dayElement);
  });
}

/* ============================
   MISE À JOUR DU FOND D'ÉCRAN
   ============================ */
function updateBackground(category) {
  // Retirer toutes les classes de fond existantes
  el.body.classList.remove(
    "sunny",
    "rainy",
    "cloudy",
    "stormy",
    "light",
    "dark"
  );

  // Ajouter la classe correspondant à la météo
  el.body.classList.add(category);
}

/* ============================
   MÉTÉO : RÉCUPÉRATION DES DONNÉES
   ============================ */

async function getWeather(cityName) {
  if (!cityName) return;
  showLoader();

  try {
    const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
      cityName
    )}&limit=1&appid=${OPENWEATHER_API_KEY}`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) throw new Error("Géocodage impossible");
    const geo = await geoRes.json();
    if (!geo || geo.length === 0) throw new Error("Ville introuvable");
    const location = geo[0];
    const nameFull = `${location.name}${
      location.state ? ", " + location.state : ""
    }, ${location.country}`;
    await getWeatherByCoords(location.lat, location.lon, nameFull);
  } catch (err) {
    console.error(err);
    alert("Erreur lors de la recherche de la ville : " + (err.message || err));
  } finally {
    hideLoader();
  }
}

async function getWeatherByCoords(lat, lon, displayName = null) {
  showLoader();
  try {
    // Météo actuelle
    const curUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`;
    const curRes = await fetch(curUrl);
    if (!curRes.ok)
      throw new Error("Impossible de récupérer la météo actuelle");
    const cur = await curRes.json();

    // Prévisions 5 jours
    const fcUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`;
    const fcRes = await fetch(fcUrl);
    if (!fcRes.ok)
      throw new Error("Impossible de récupérer la prévision 5 jours");
    const fc = await fcRes.json();

    const display =
      displayName ||
      `${cur.name}${cur.sys && cur.sys.country ? ", " + cur.sys.country : ""}`;

    // Enregistrer la dernière ville
    localStorage.setItem(
      STORAGE_KEYS.LAST_CITY,
      JSON.stringify({ name: display, lat, lon })
    );

    // Sauvegarder dans les villes enregistrées
    addSavedCity({
      name: display,
      lat,
      lon,
      country: cur.sys && cur.sys.country ? cur.sys.country : "",
    });

    // Mettre à jour l'interface
    updateUIFromCurrent(cur, display);
    renderForecast(fc);

    // Mettre à jour le fond
    const cat = weatherCategory(
      cur.weather && cur.weather[0] && cur.weather[0].main
    );
    updateBackground(cat);
  } catch (err) {
    console.error(err);
    alert("Erreur lors de la récupération météo : " + (err.message || err));
  } finally {
    hideLoader();
  }
}

/* ============================
   MISE À JOUR INTERFACE
   ============================ */
function updateUIFromCurrent(cur, displayName) {
  const tzOffset = cur.timezone || 0;
  const nowUnix = Math.floor(Date.now() / 1000);

  el.cityName.textContent = displayName || cur.name || "—";
  el.localTime.textContent = `Heure locale : ${formatLocalTime(
    nowUnix,
    tzOffset
  )}`;
  el.temperature.textContent = formatTemp(cur.main.temp, true);
  el.humidity.textContent = `${cur.main.humidity}%`;
  el.wind.textContent = msToKmh(cur.wind.speed);

  // Icône météo
  const icon = cur.weather && cur.weather[0] ? cur.weather[0].icon : null;
  if (icon) {
    el.weatherIcon.src = `https://openweathermap.org/img/wn/${icon}@4x.png`;
    el.weatherIcon.alt = cur.weather[0].description || "icone météo";
  } else {
    el.weatherIcon.src = "";
  }

  // Animation fade-in
  const card = document.querySelector(".weather-card");
  if (card) {
    card.classList.remove("fade-in");
    void card.offsetWidth;
    card.classList.add("fade-in");
  }
}

/* ============================
   GÉOLOCALISATION
   ============================ */
function getLocation() {
  showLoader();
  if (!navigator.geolocation) {
    alert("La géolocalisation n'est pas supportée par votre navigateur");
    hideLoader();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      await getWeatherByCoords(lat, lon, "Votre position");
    },
    (error) => {
      hideLoader();
      alert("Impossible d'obtenir votre position: " + error.message);
    }
  );
}

/* ============================
   CHARGEMENT AU DÉMARRAGE
   ============================ */
function loadLastCity() {
  try {
    const last = localStorage.getItem(STORAGE_KEYS.LAST_CITY);
    if (last) {
      const city = JSON.parse(last);
      getWeatherByCoords(city.lat, city.lon, city.name);
    }
  } catch (e) {
    console.warn("Erreur lors du chargement de la dernière ville", e);
  }
}

/* ============================
   INITIALISATION
   ============================ */
function init() {
  // Charger le thème
  loadTheme();

  // Charger les villes sauvegardées
  renderSavedCities();

  // Charger la dernière ville consultée
  loadLastCity();

  // Événements
  el.btnSearch.addEventListener("click", () =>
    getWeather(el.input.value.trim())
  );

  el.btnGeo.addEventListener("click", getLocation);

  el.themeToggle.addEventListener("click", toggleTheme);

  el.input.addEventListener("input", (e) => {
    fetchSuggestions(e.target.value.trim());
  });

  el.input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      getWeather(el.input.value.trim());
    }
  });

  // Cacher les suggestions quand on clique ailleurs
  document.addEventListener("click", (e) => {
    if (!el.suggestions.contains(e.target) && e.target !== el.input) {
      el.suggestions.style.display = "none";
    }
  });
}

// Démarrer l'application quand la page est chargée
document.addEventListener("DOMContentLoaded", init);

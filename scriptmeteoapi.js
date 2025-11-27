const OPENWEATHER_API_KEY = "74477f24ec377dbaff9cf6655557f728";
const GEO_LIMIT = 5;
const STORAGE_KEYS = {
  SAVED: "meteo_saved_cities_v1",
  THEME: "meteo_theme_v1",
  LAST_CITY: "meteo_last_city_v1",
};

/* ============================
   DOM
============================ */
const el = {
  input: document.getElementById("searchInput"),
  btnSearch: document.getElementById("searchBtn"),
  btnGeo: document.getElementById("geoBtn"),
  suggestions: document.getElementById("suggestions"),
  loader: null,
  cityName: document.getElementById("cityName"),
  localTime: document.getElementById("localTime"),
  weatherIcon: document.getElementById("weatherIcon"),
  temperature: document.getElementById("temperature"),
  humidity: document.getElementById("humidity"),
  wind: document.getElementById("wind"),
  feelsLike: document.getElementById("feelsLike"),
  forecastContainer: document.getElementById("forecast"),
  savedCitiesDiv: document.getElementById("savedCities"),
  themeToggle: document.getElementById("theme-toggle"),
  body: document.body,
  currentDate: document.getElementById("currentDate"),
  sunrise: document.getElementById("sunrise"),
  sunset: document.getElementById("sunset"),
};

/* loader */
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
    document
      .querySelector(".app")
      .insertBefore(ld, document.querySelector(".weather-card"));
  }
  el.loader = ld;
})();
function showLoader() {
  el.loader.style.display = "block";
}
function hideLoader() {
  el.loader.style.display = "none";
}

/* helpers */
function msToKmh(ms) {
  if (ms === null || ms === undefined) return "—";
  return `${Math.round(ms * 3.6)} km/h`;
}

function formatLocalTimeFromOffset(unixUtcSeconds, timezoneOffsetSeconds) {
  const localMillis = (unixUtcSeconds + timezoneOffsetSeconds) * 1000;
  const d = new Date(localMillis);
  const h = d.getUTCHours().toString().padStart(2, "0");
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function weatherCategory(main) {
  if (!main) return "cloudy";
  const m = main.toLowerCase();
  if (m.includes("clear")) return "sunny";
  if (m.includes("rain") || m.includes("drizzle")) return "rainy";
  if (m.includes("thunder") || m.includes("storm")) return "stormy";
  if (m.includes("cloud") || m.includes("snow")) return "cloudy";
  return "cloudy";
}

/* ============================
   LOCAL STORAGE (villes sauvegardées)
============================ */
function loadSavedCities() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn(e);
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

function renderSavedCities() {
  const list = loadSavedCities();
  el.savedCitiesDiv.innerHTML = "";
  if (!list || list.length === 0) {
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
   AUTOCOMPLÉTION
============================ */
let autocompleteAbortController = null;
let debounceTimer = null;
let suggestionIndex = -1;

async function fetchSuggestions(query) {
  clearTimeout(debounceTimer);
  suggestionIndex = -1;
  if (!query || query.length < 2) {
    el.suggestions.style.display = "none";
    el.input.setAttribute("aria-expanded", "false");
    return;
  }

  debounceTimer = setTimeout(async () => {
    const saved = loadSavedCities()
      .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 3)
      .map((s) => ({ name: s.name, lat: s.lat, lon: s.lon }));

    if (!OPENWEATHER_API_KEY) {
      renderSuggestions(saved);
      return;
    }

    if (autocompleteAbortController) autocompleteAbortController.abort();
    autocompleteAbortController = new AbortController();

    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
      query
    )}&limit=${GEO_LIMIT}&appid=${OPENWEATHER_API_KEY}`;
    try {
      const res = await fetch(url, {
        signal: autocompleteAbortController.signal,
      });
      if (!res.ok) {
        renderSuggestions(saved);
        return;
      }
      const data = await res.json();
      const items = data.map((it) => ({
        name: `${it.name}${it.state ? ", " + it.state : ""}, ${it.country}`,
        lat: it.lat,
        lon: it.lon,
      }));
      renderSuggestions([...saved, ...items]);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("Erreur autocomplétion", err);
      renderSuggestions(saved);
    }
  }, 300);
}

function renderSuggestions(list) {
  el.suggestions.innerHTML = "";
  if (!list || list.length === 0) {
    el.suggestions.style.display = "none";
    el.input.setAttribute("aria-expanded", "false");
    return;
  }
  el.suggestions.style.display = "block";
  el.input.setAttribute("aria-expanded", "true");

  list.forEach((item, idx) => {
    const li = document.createElement("li");
    li.textContent = item.name;
    li.setAttribute("role", "option");
    li.setAttribute("data-lat", item.lat ?? "");
    li.setAttribute("data-lon", item.lon ?? "");
    li.tabIndex = -1;
    li.addEventListener("click", () => {
      el.input.value = item.name;
      el.suggestions.style.display = "none";
      el.input.setAttribute("aria-expanded", "false");
      if (item.lat && item.lon)
        getWeatherByCoords(item.lat, item.lon, item.name);
      else getWeather(item.name);
    });
    el.suggestions.appendChild(li);
  });
}

el.input?.addEventListener("keydown", (e) => {
  const items = Array.from(el.suggestions.querySelectorAll("li"));
  if (el.suggestions.style.display === "none" || items.length === 0) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    suggestionIndex = Math.min(suggestionIndex + 1, items.length - 1);
    updateSuggestionSelection(items);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    suggestionIndex = Math.max(suggestionIndex - 1, 0);
    updateSuggestionSelection(items);
  } else if (e.key === "Enter") {
    if (suggestionIndex >= 0 && items[suggestionIndex]) {
      e.preventDefault();
      items[suggestionIndex].click();
    }
  } else if (e.key === "Escape") {
    el.suggestions.style.display = "none";
    el.input.setAttribute("aria-expanded", "false");
  }
});

function updateSuggestionSelection(items) {
  items.forEach((it, i) => {
    it.setAttribute("aria-selected", i === suggestionIndex ? "true" : "false");
    if (i === suggestionIndex) {
      it.scrollIntoView({ block: "nearest" });
    }
  });
}

/* ============================
   FORECAST RENDER
============================ */
function renderForecast(forecastData) {
  if (!forecastData || !forecastData.list) {
    el.forecastContainer.innerHTML =
      "<p>Données de prévision non disponibles</p>";
    return;
  }

  const dailyForecasts = {};
  forecastData.list.forEach((item) => {
    const date = new Date(item.dt * 1000);
    const dayKey = date.toDateString();
    if (!dailyForecasts[dayKey]) dailyForecasts[dayKey] = { date, items: [] };
    dailyForecasts[dayKey].items.push(item);
  });

  const days = Object.values(dailyForecasts).slice(0, 5);
  el.forecastContainer.innerHTML = "";
  days.forEach((day) => {
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
      <p>${Math.round(forecast.main.temp)}°C</p>
      <p style="text-transform:capitalize">${weather.description}</p>
      <p><small>Humidité: ${forecast.main.humidity}%</small></p>
    `;
    el.forecastContainer.appendChild(dayElement);
  });
}

/* ============================
   BACKGROUND UPDATE
============================ */
function updateBackground(category) {
  el.body.classList.remove("sunny", "rainy", "cloudy", "stormy");
  el.body.classList.add(category);
}

/* ============================
   WEATHER FETCH
============================ */
async function getWeather(cityName) {
  if (!cityName) return;
  if (!OPENWEATHER_API_KEY) {
    alert("Clé API OpenWeather manquante.");
    return;
  }

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
  if (!OPENWEATHER_API_KEY) {
    alert("Clé API OpenWeather manquante.");
    return;
  }
  showLoader();
  try {
    const curUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    const fcUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;

    const [curRes, fcRes] = await Promise.all([fetch(curUrl), fetch(fcUrl)]);
    if (!curRes.ok)
      throw new Error("Impossible de récupérer la météo actuelle");
    if (!fcRes.ok)
      throw new Error("Impossible de récupérer la prévision 5 jours");

    const cur = await curRes.json();
    const fc = await fcRes.json();

    const display =
      displayName ||
      `${cur.name}${cur.sys && cur.sys.country ? ", " + cur.sys.country : ""}`;

    localStorage.setItem(
      STORAGE_KEYS.LAST_CITY,
      JSON.stringify({ name: display, lat, lon })
    );
    addSavedCity({
      name: display,
      lat,
      lon,
      country: cur.sys && cur.sys.country ? cur.sys.country : "",
    });

    updateUIFromCurrent(cur, display);
    renderForecast(fc);

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
   UPDATE UI
============================ */
function updateUIFromCurrent(cur, displayName) {
  const tzOffset = cur.timezone || 0;
  const nowUnix = Math.floor(Date.now() / 1000);

  el.cityName.textContent = displayName || cur.name || "—";
  el.localTime.textContent = `Heure locale : ${formatLocalTimeFromOffset(
    nowUnix,
    tzOffset
  )}`;
  el.temperature.textContent = `${Math.round(cur.main.temp)}°C`;
  el.humidity.textContent = `${cur.main.humidity}%`;
  el.wind.textContent = msToKmh(cur.wind?.speed ?? 0);
  el.feelsLike.textContent = `${Math.round(cur.main.feels_like)}°C`;

  // Lever et coucher du soleil
  if (cur.sys) {
    if (el.sunrise)
      el.sunrise.textContent = `🌅 Lever : ${formatLocalTimeFromOffset(
        cur.sys.sunrise,
        tzOffset
      )}`;
    if (el.sunset)
      el.sunset.textContent = `🌇 Coucher : ${formatLocalTimeFromOffset(
        cur.sys.sunset,
        tzOffset
      )}`;
  }

  const icon = cur.weather?.[0]?.icon ?? null;
  if (icon) {
    el.weatherIcon.src = `https://openweathermap.org/img/wn/${icon}@4x.png`;
    el.weatherIcon.alt = cur.weather[0]?.description || "icone météo";
  } else {
    el.weatherIcon.src = "";
    el.weatherIcon.alt = "";
  }

  const card = document.querySelector(".weather-card");
  if (card) {
    card.classList.remove("fade-in");
    void card.offsetWidth;
    card.classList.add("fade-in");
  }

  if (el.currentDate)
    el.currentDate.textContent = `📅 Date : ${new Date(
      (nowUnix + tzOffset) * 1000
    ).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    })}`;
}

/* ============================
   GEOLOCALISATION
============================ */
async function getCityFromCoords(lat, lon) {
  const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${OPENWEATHER_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data && data.length > 0) {
    return { name: `${data[0].name}, ${data[0].country}`, lat, lon };
  }
  return { name: "Ville inconnue", lat, lon };
}

function getLocation() {
  showLoader();
  if (!navigator.geolocation) {
    alert("La géolocalisation n'est pas supportée par votre navigateur");
    hideLoader();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude,
        lon = position.coords.longitude;
      const city = await getCityFromCoords(lat, lon);
      getWeatherByCoords(city.lat, city.lon, city.name);
    },
    (error) => {
      hideLoader();
      alert("Impossible d'obtenir votre position: " + error.message);
    }
  );
}

/* ============================
   LAST CITY LOAD & THEME
============================ */
function loadLastCity() {
  try {
    const last = localStorage.getItem(STORAGE_KEYS.LAST_CITY);
    if (last) {
      const city = JSON.parse(last);
      getWeatherByCoords(city.lat, city.lon, city.name);
    }
  } catch (e) {
    console.warn(e);
  }
}

function loadTheme() {
  const t = localStorage.getItem(STORAGE_KEYS.THEME);
  if (t === "dark") el.body.classList.add("dark");
  else el.body.classList.remove("dark");
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
  if (!el.themeToggle) return;
  el.themeToggle.textContent = el.body.classList.contains("dark") ? "☀️" : "🌙";
}

/* ============================
   INIT
============================ */
function init() {
  loadTheme();
  renderSavedCities();
  loadLastCity();

  el.btnSearch.addEventListener("click", () =>
    getWeather(el.input.value.trim())
  );
  el.btnGeo.addEventListener("click", getLocation);
  el.themeToggle.addEventListener("click", toggleTheme);

  el.input.addEventListener("input", (e) =>
    fetchSuggestions(e.target.value.trim())
  );
  el.input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") getWeather(el.input.value.trim());
  });

  document.addEventListener("click", (e) => {
    if (!el.suggestions.contains(e.target) && e.target !== el.input) {
      el.suggestions.style.display = "none";
      el.input.setAttribute("aria-expanded", "false");
    }
  });
}

document.addEventListener("DOMContentLoaded", init);

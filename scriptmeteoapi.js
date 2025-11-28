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
  weatherState: document.getElementById("weatherState"),
  hourlyForecast: document.getElementById("hourlyForecast"),
  // NOUVEAUX ÉLÉMENTS : Indices météo
  heatIndex: document.getElementById("heatIndex"),
  windComfort: document.getElementById("windComfort"),
  clothingAdvice: document.getElementById("clothingAdvice"),
};

/* loader */
// Fonction auto-exécutée pour s'assurer que le loader existe dans le DOM
(function ensureLoader() {
  // On cherche d'abord un élément avec l'ID "loader"
  let ld = document.getElementById("loader");
  if (!ld) {
    // Si aucun loader n'existe, on le crée
    ld = document.createElement("div"); // création d'une div
    ld.id = "loader"; // attribution de l'ID "loader"
    ld.textContent = "🔄 Chargement..."; // texte affiché dans le loader
    // Style de base du loader
    ld.style.display = "none"; // caché par défaut
    ld.style.textAlign = "center"; // texte centré
    ld.style.margin = "12px 0"; // marge verticale
    ld.style.fontSize = "18px"; // taille du texte
    // On insère le loader dans l'application avant la section "top-sections"
    document
      .querySelector(".app")
      .insertBefore(ld, document.querySelector(".top-sections"));
  } // On stocke la référence du loader dans notre objet el
  el.loader = ld;
})();
// Fonction pour afficher le loader
function showLoader() {
  if (el.loader) el.loader.style.display = "block";
} //cacher le loader
function hideLoader() {
  if (el.loader) el.loader.style.display = "none";
}

/* helpers */
// Convertit une vitesse de mètres par seconde (m/s) en kilomètres par heure (km/h)
function msToKmh(ms) {
  // Si la valeur est nulle ou indéfinie, on retourne un tiret
  if (ms === null || ms === undefined) return "—";

  // Conversion : 1 m/s = 3.6 km/h, puis arrondi à l'entier
  return `${Math.round(ms * 3.6)} km/h`;
}
// Convertit un timestamp UNIX UTC en heure locale selon le décalage horaire fourni
function formatLocalTimeFromOffset(unixUtcSeconds, timezoneOffsetSeconds) {
  // Si le timestamp est null ou undefined (ou autre valeur "falsy" non valide), on retourne un tiret
  if (!unixUtcSeconds && unixUtcSeconds !== 0) return "—";
  // Calcul du temps local en millisecondes : timestamp + décalage (en secondes), puis conversion en ms
  const localMillis = (unixUtcSeconds + (timezoneOffsetSeconds || 0)) * 1000;
  // Création d'un objet Date avec le temps local
  const d = new Date(localMillis);
  // Récupération des heures et minutes UTC (ajustées par le décalage)
  const h = d.getUTCHours().toString().padStart(2, "0"); // format 2 chiffres
  const m = d.getUTCMinutes().toString().padStart(2, "0"); // format 2 chiffres
  // Retourne l'heure locale formatée "HH:MM"
  return `${h}:${m}`;
}
// Retourne une catégorie météo simplifiée ("sunny", "rainy", "stormy", "cloudy") à partir du paramètre main
function weatherCategory(main) {
  // Si aucune donnée n'est fournie, on considère le temps nuageux par défaut
  if (!main) return "cloudy";
  // Conversion en minuscules pour faciliter la comparaison
  const m = main.toLowerCase();
  // Si le texte contient "clear", on retourne "sunny"
  if (m.includes("clear")) return "sunny";
  // Si le texte contient "rain" ou "drizzle", on retourne "rainy"
  if (m.includes("rain") || m.includes("drizzle")) return "rainy";
  // Si le texte contient "thunder" ou "storm", on retourne "stormy"
  if (m.includes("thunder") || m.includes("storm")) return "stormy";
  // Si le texte contient "cloud" ou "snow", on retourne "cloudy"
  if (m.includes("cloud") || m.includes("snow")) return "cloudy";
  // Par défaut, si aucune condition n'est remplie, on retourne "cloudy"
  return "cloudy";
}
//NOUVELLES FONCTIONS : Indices météo
function calculateHeatIndex(temp, humidity) {
  // Formule simplifiée de l'indice de chaleur
  if (temp < 27) return "Faible";

  const HI =
    -8.78469475556 +
    1.61139411 * temp +
    2.33854883889 * humidity +
    -0.14611605 * temp * humidity +
    -0.012308094 * temp * temp +
    -0.0164248277778 * humidity * humidity +
    0.002211732 * temp * temp * humidity +
    0.00072546 * temp * humidity * humidity +
    -0.000003582 * temp * temp * humidity * humidity;

  if (HI < 27) return "Faible";
  if (HI < 32) return "Modéré";
  if (HI < 41) return "Élevé";
  if (HI < 54) return "Très élevé";
  return "Extrême";
}

function calculateWindComfort(windSpeed) {
  if (windSpeed < 5) return "Agréable";
  if (windSpeed < 15) return "Léger vent";
  if (windSpeed < 25) return "Venté";
  if (windSpeed < 35) return "Très venté";
  return "Vent violent";
}

function getClothingAdvice(temp, weatherMain) {
  const main = weatherMain.toLowerCase();

  if (temp >= 30) return "Tenue légère 🩳";
  if (temp >= 25) return "T-shirt léger 👕";
  if (temp >= 20) return "Manches longues 🧥";
  if (temp >= 15) return "Pull léger 🧶";
  if (temp >= 10) return "Veste chaude 🧥";
  if (temp >= 5) return "Manteau + écharpe 🧣";
  if (temp >= 0) return "Manteau épais 🧥";

  if (main.includes("rain")) return "Imperméable ☔";
  if (main.includes("snow")) return "Vêtements chauds ⛄";
  if (main.includes("storm")) return "Vêtements imperméables ⚡";

  return "Manteau très chaud 🥶";
}

function updateWeatherIndices(weatherData) {
  const temp = weatherData.main.temp;
  const humidity = weatherData.main.humidity;
  const windSpeed = weatherData.wind?.speed || 0;
  const weatherMain = weatherData.weather[0].main;

  // Mettre à jour les indices
  if (el.heatIndex) {
    el.heatIndex.textContent = calculateHeatIndex(temp, humidity);
  }

  if (el.windComfort) {
    el.windComfort.textContent = calculateWindComfort(windSpeed * 3.6); // Conversion en km/h
  }

  if (el.clothingAdvice) {
    el.clothingAdvice.textContent = getClothingAdvice(temp, weatherMain);
  }
}

/* ============================
   NOUVELLES ICÔNES SVG améliorées
============================ */
// Fonction pour convertir un SVG en Data URI afin de pouvoir l'utiliser directement comme source d'image
function svgToDataUri(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Objet contenant les SVG météo encodés en Data URI pour chaque état du temps
const ICON_SVGS = {
  // Soleil clair
  Clear: svgToDataUri(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
      <circle cx='32' cy='32' r='16' fill='#FFD700' stroke='#FFA500' stroke-width='2'/>
      <g stroke='#FFA500' stroke-width='3' stroke-linecap='round'>
        <line x1='32' y1='4' x2='32' y2='12'/>
        <line x1='32' y1='52' x2='32' y2='60'/>
        <line x1='4' y1='32' x2='12' y2='32'/>
        <line x1='52' y1='32' x2='60' y2='32'/>
        <line x1='12' y1='12' x2='18' y2='18'/>
        <line x1='46' y1='46' x2='52' y2='52'/>
        <line x1='46' y1='18' x2='52' y2='12'/>
        <line x1='12' y1='52' x2='18' y2='46'/>
      </g>
    </svg>
  `),

  // Nuages
  Clouds: svgToDataUri(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
      <g fill='#F0F8FF'>
        <ellipse cx='25' cy='38' rx='20' ry='12'/>
        <ellipse cx='40' cy='34' rx='14' ry='10'/>
        <ellipse cx='15' cy='32' rx='12' ry='8'/>
      </g>
    </svg>
  `),

  // Pluie
  Rain: svgToDataUri(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
      <g fill='#E6F3FF'>
        <ellipse cx='25' cy='30' rx='20' ry='12'/>
        <ellipse cx='40' cy='26' rx='14' ry='10'/>
      </g>
      <g fill='#4DA0FF' stroke='#4DA0FF' stroke-width='1'>
        <path d='M18 45 L16 52 M24 43 L22 50 M30 45 L28 52 M36 43 L34 50 M42 45 L40 52'/>
      </g>
    </svg>
  `),

  // Orage / Tempête
  Storm: svgToDataUri(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
      <g fill='#D4E4F7'>
        <ellipse cx='25' cy='28' rx='20' ry='12'/>
        <ellipse cx='40' cy='24' rx='14' ry='10'/>
      </g>
      <path d='M28 32 L22 48 L34 48 L28 64 Z' fill='#FFD700' transform='translate(0,-12)'/>
    </svg>
  `),

  // Neige
  Snow: svgToDataUri(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
      <g fill='#F0F8FF'>
        <ellipse cx='25' cy='30' rx='20' ry='12'/>
        <ellipse cx='40' cy='26' rx='14' ry='10'/>
      </g>
      <g stroke='#B0E0E6' stroke-width='2' stroke-linecap='round'>
        <line x1='20' y1='45' x2='20' y2='50'/>
        <line x1='17' y1='47.5' x2='23' y2='47.5'/>
        <line x1='32' y1='45' x2='32' y2='50'/>
        <line x1='29' y1='47.5' x2='35' y2='47.5'/>
        <line x1='44' y1='45' x2='44' y2='50'/>
        <line x1='41' y1='47.5' x2='47' y2='47.5'/>
      </g>
    </svg>
  `),

  // Brouillard / Brume
  Mist: svgToDataUri(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
      <g fill='#F5F5F5' opacity='0.7'>
        <ellipse cx='25' cy='30' rx='20' ry='8'/>
        <ellipse cx='40' cy='26' rx='14' ry='6'/>
      </g>
      <g stroke='#C0C0C0' stroke-width='2' stroke-linecap='round' opacity='0.6'>
        <line x1='10' y1='40' x2='54' y2='40'/>
        <line x1='8' y1='45' x2='56' y2='45'/>
        <line x1='12' y1='50' x2='52' y2='50'/>
      </g>
    </svg>
  `),

  // Icône par défaut si aucune condition correspond
  Default: svgToDataUri(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
      <circle cx='32' cy='32' r='15' fill='#E0E0E0' stroke='#B0B0B0' stroke-width='2'/>
    </svg>
  `),
};

function getColoredIconFor(main) {
  if (!main) return ICON_SVGS.Default;
  const m = main.toLowerCase();
  if (m.includes("clear")) return ICON_SVGS.Clear;
  if (m.includes("rain") || m.includes("drizzle")) return ICON_SVGS.Rain;
  if (m.includes("thunder") || m.includes("storm")) return ICON_SVGS.Storm;
  if (m.includes("cloud")) return ICON_SVGS.Clouds;
  if (m.includes("snow")) return ICON_SVGS.Snow;
  if (m.includes("mist") || m.includes("fog") || m.includes("haze"))
    return ICON_SVGS.Mist;
  return ICON_SVGS.Default;
}

/* ============================
   LOCAL STORAGE
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
// Fonction pour afficher une liste de suggestions de villes sous le champ de recherche
function renderSuggestions(list) {
  // On vide d'abord le contenu précédent des suggestions
  el.suggestions.innerHTML = "";

  // Si la liste est vide ou inexistante, on cache le conteneur de suggestions
  if (!list || list.length === 0) {
    el.suggestions.style.display = "none"; // masquer la liste
    el.input.setAttribute("aria-expanded", "false"); // accessibilité : indique que la liste est fermée
    return;
  }

  // Sinon, on affiche le conteneur de suggestions
  el.suggestions.style.display = "block";
  el.input.setAttribute("aria-expanded", "true"); // accessibilité : indique que la liste est ouverte

  // Pour chaque élément de la liste, on crée un <li>
  list.forEach((item, idx) => {
    const li = document.createElement("li"); // création de l'élément
    li.textContent = item.name; // affichage du nom de la ville
    li.setAttribute("role", "option"); // rôle ARIA pour accessibilité
    li.setAttribute("data-lat", item.lat ?? ""); // stockage latitude
    li.setAttribute("data-lon", item.lon ?? ""); // stockage longitude
    li.tabIndex = -1; // rend le <li> focusable par script mais pas par tabulation

    // Au clic sur un élément, on met à jour le champ de recherche et récupère la météo
    li.addEventListener("click", () => {
      el.input.value = item.name; // mettre à jour le champ
      el.suggestions.style.display = "none"; // cacher la liste
      el.input.setAttribute("aria-expanded", "false"); // accessibilité : liste fermée

      // Si les coordonnées sont disponibles, on appelle la météo par coordonnées
      if (item.lat && item.lon)
        getWeatherByCoords(item.lat, item.lon, item.name);
      else getWeather(item.name); // sinon par nom de ville
    });

    // On ajoute l'élément à la liste des suggestions
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
      <img src="${getColoredIconFor(weather.main)}" alt="${
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
   PRÉVISIONS HORAIRES (côte à côte)
============================ */
function renderHourlyForecast(forecastData) {
  if (!el.hourlyForecast) return;

  if (!forecastData || !forecastData.list) {
    el.hourlyForecast.innerHTML = "<p>Aucune donnée horaire disponible</p>";
    return;
  }

  // Prendre les 24 prochaines heures
  const next24Hours = forecastData.list.slice(0, 8); // 8 * 3h = 24h
  const tzOffset = forecastData.city?.timezone || 0;

  el.hourlyForecast.innerHTML = "";

  next24Hours.forEach((hourData) => {
    const date = new Date((hourData.dt + tzOffset) * 1000);
    const hour = date.getUTCHours().toString().padStart(2, "0");
    const weather = hourData.weather[0];
    const temp = Math.round(hourData.main.temp);

    const card = document.createElement("div");
    card.className = "hour-card";
    card.innerHTML = `
      <div class="hour-time">${hour}h</div>
      <img src="${getColoredIconFor(weather.main)}" alt="${
      weather.description
    }">
      <div class="hour-temp">${temp}°C</div>
      <div class="hour-desc">${weather.description}</div>
    `;
    el.hourlyForecast.appendChild(card);
  });
}

/* ============================
   BACKGROUND UPDATE
============================ */
function updateBackground(category) {
  el.body.classList.remove("sunny", "rainy", "cloudy", "stormy");
  el.body.classList.add(category);

  // Nettoyer anciens effets
  document.querySelectorAll(".rain-effect").forEach((e) => e.remove());
  document.querySelectorAll(".sun-rays").forEach((e) => e.remove());
  document.querySelectorAll(".lightning").forEach((e) => e.remove());

  // Ajouter les effets selon catégorie
  if (category === "rainy") createRainEffect();
  if (category === "sunny") createSunRays();
  if (category === "stormy") createLightning();
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
    const curUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=fr`;
    const fcUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=fr`;

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
    renderHourlyForecast(fc);

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

  // NOUVEAU : État météo textuel
  if (el.weatherState && cur.weather && cur.weather[0]) {
    const weatherDesc = cur.weather[0].description;
    el.weatherState.textContent =
      weatherDesc.charAt(0).toUpperCase() + weatherDesc.slice(1);
  }

  // NOUVEAU : Mettre à jour les indices météo
  updateWeatherIndices(cur);

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

  // Icône colorée (SVG inline data-uri)
  const main = cur.weather?.[0]?.main || "";
  el.weatherIcon.src = getColoredIconFor(main);
  el.weatherIcon.alt = cur.weather?.[0]?.description || "icone météo";
  el.weatherIcon.style.filter = "none";
  el.weatherIcon.style.width = "140px";
  el.weatherIcon.style.height = "auto";

  // Animation carte
  const card = document.querySelector(".weather-card");
  if (card) {
    card.classList.remove("fade-in");
    void card.offsetWidth;
    card.classList.add("fade-in");
  }

  // Date locale
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

/* ============================
   EFFETS DYNAMIQUES
============================ */
function createRainEffect() {
  const rainContainer = document.createElement("div");
  rainContainer.className = "rain-effect";
  document.body.appendChild(rainContainer);

  for (let i = 0; i < 100; i++) {
    const drop = document.createElement("div");
    drop.className = "rain-drop";
    drop.style.left = Math.random() * 100 + "vw";
    drop.style.animationDuration = Math.random() * 0.6 + 0.6 + "s";
    drop.style.animationDelay = Math.random() * 2 + "s";
    rainContainer.appendChild(drop);
  }
  setTimeout(() => rainContainer.classList.add("active"), 50);
}

function createSunRays() {
  const rays = document.createElement("div");
  rays.className = "sun-rays active";
  document.body.appendChild(rays);
}

function createLightning() {
  const lightning = document.createElement("div");
  lightning.className = "lightning";
  document.body.appendChild(lightning);

  const iv = setInterval(() => {
    lightning.style.opacity = Math.random() > 0.75 ? 1 : 0;
    setTimeout(() => (lightning.style.opacity = 0), 150);
  }, 2000);

  setTimeout(() => clearInterval(iv), 40000);
}

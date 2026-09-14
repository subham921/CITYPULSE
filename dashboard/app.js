// CITYPULSE Mappls Map & Command Center Integration
const API = new URLSearchParams(location.search).get("api") || "/api/v1";
const DEFAULT_CENTER = [22.5726, 88.3639]; // Central Kolkata
const DEFAULT_ZOOM = 13;

const el = id => document.getElementById(id);
const safe = value => String(value ?? "—").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function formatDetectionTime(isoString) {
  if (!isoString) return { date: "—", time: "—", relative: "", fullFormatted: "—" };
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { date: safe(isoString), time: "", relative: "", fullFormatted: safe(isoString) };

    const dateStr = d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });

    const timeStr = d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });

    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    let relStr = "";
    if (diffSec >= 0) {
      if (diffSec < 60) {
        relStr = "Just now";
      } else if (diffSec < 3600) {
        relStr = `${Math.floor(diffSec / 60)}m ago`;
      } else if (diffSec < 86400) {
        relStr = `${Math.floor(diffSec / 3600)}h ago`;
      } else {
        relStr = `${Math.floor(diffSec / 86400)}d ago`;
      }
    }

    return {
      date: dateStr,
      time: timeStr,
      relative: relStr,
      fullFormatted: `${dateStr}, ${timeStr}`
    };
  } catch (e) {
    return { date: safe(isoString), time: "", relative: "", fullFormatted: safe(isoString) };
  }
}

let activeMapplsKey = new URLSearchParams(location.search).get("map_key") 
  || localStorage.getItem("mappls_api_key") 
  || "vfprupvufqvkbaarmpgonnlgzzgnnkzetirt";

let cityMap = null;
let fallbackGisMap = null;
let eventMarkers = [];
let allEvents = [];

// ══════════════════════════════════════════════════════════════════════
// 1. Kolkata Vector GIS Engine (Interactive Canvas Renderer)
// ══════════════════════════════════════════════════════════════════════
class KolkataGISMap {
  constructor(containerId) {
    this.container = el(containerId);
    if (!this.container) return;
    this.container.innerHTML = "";
    this.container.style.position = "relative";
    this.container.style.overflow = "hidden";

    this.centerLat = DEFAULT_CENTER[0];
    this.centerLng = DEFAULT_CENTER[1];
    this.zoom = DEFAULT_ZOOM;
    this.minZoom = 11;
    this.maxZoom = 16;
    this.events = [];
    this.selectedEvent = null;

    // Canvas
    this.canvas = document.createElement("canvas");
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.cursor = "grab";
    this.ctx = this.canvas.getContext("2d");
    this.container.appendChild(this.canvas);

    // Overlay for UI & Popups
    this.overlay = document.createElement("div");
    this.overlay.className = "gis-map-overlay";
    this.container.appendChild(this.overlay);

    this.setupUI();
    this.setupInteractions();
    this.resize();
    window.addEventListener("resize", () => this.resize());

    // Pulse animation loop
    this.pulsePhase = 0;
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupUI() {
    this.overlay.innerHTML = `
      <div class="gis-top-bar">
        <div class="gis-status-badge">
          <span class="gis-status-dot"></span>
          <span>Mappls GIS Engine · Kolkata Live Transit &amp; Safety Map</span>
        </div>
      </div>
      <div class="gis-zoom-ctrl">
        <button id="gis-zoom-in" class="gis-btn" title="Zoom In">+</button>
        <button id="gis-zoom-out" class="gis-btn" title="Zoom Out">−</button>
        <button id="gis-recenter" class="gis-btn" title="Center Kolkata Fleet">⌖</button>
      </div>
      <div id="gis-popup-card" class="gis-popup" style="display:none;"></div>
    `;

    el("gis-zoom-in").addEventListener("click", () => this.setZoom(this.zoom + 1));
    el("gis-zoom-out").addEventListener("click", () => this.setZoom(this.zoom - 1));
    el("gis-recenter").addEventListener("click", () => this.setCenter(DEFAULT_CENTER, DEFAULT_ZOOM));
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width || 800;
    this.height = rect.height || 440;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.render();
  }

  project(lat, lng) {
    const scale = (Math.pow(2, this.zoom) * 256) / 360;
    const rad = this.centerLat * Math.PI / 180;
    const x = this.width / 2 + (lng - this.centerLng) * scale * Math.cos(rad);
    const y = this.height / 2 - (lat - this.centerLat) * scale;
    return { x, y };
  }

  unproject(x, y) {
    const scale = (Math.pow(2, this.zoom) * 256) / 360;
    const rad = this.centerLat * Math.PI / 180;
    const lng = this.centerLng + (x - this.width / 2) / (scale * Math.cos(rad));
    const lat = this.centerLat - (y - this.height / 2) / scale;
    return { lat, lng };
  }

  setCenter(coords, zoom) {
    this.centerLat = coords[0];
    this.centerLng = coords[1];
    if (zoom) this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    this.closePopup();
    this.render();
  }

  setZoom(z) {
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, z));
    this.closePopup();
    this.render();
  }

  setEvents(events) {
    this.events = events || [];
    this.render();
  }

  setupInteractions() {
    let isDragging = false;
    let startX = 0, startY = 0;
    let initCenterLat = 0, initCenterLng = 0;

    this.canvas.addEventListener("mousedown", e => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initCenterLat = this.centerLat;
      initCenterLng = this.centerLng;
      this.canvas.style.cursor = "grabbing";
    });

    window.addEventListener("mousemove", e => {
      if (!isDragging) {
        // Check hover over markers
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const hovered = this.findMarkerAt(mx, my);
        this.canvas.style.cursor = hovered ? "pointer" : "grab";
        return;
      }
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const scale = (Math.pow(2, this.zoom) * 256) / 360;
      const rad = this.centerLat * Math.PI / 180;
      this.centerLng = initCenterLng - dx / (scale * Math.cos(rad));
      this.centerLat = initCenterLat + dy / scale;
      this.render();
    });

    window.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        this.canvas.style.cursor = "grab";
      }
    });

    this.canvas.addEventListener("click", e => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const clicked = this.findMarkerAt(mx, my);
      if (clicked) {
        this.showPopup(clicked);
      } else {
        this.closePopup();
      }
    });

    this.canvas.addEventListener("wheel", e => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.3 : -0.3;
      this.setZoom(this.zoom + delta);
    }, { passive: false });
  }

  findMarkerAt(x, y) {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const ev = this.events[i];
      const loc = ev.location || {};
      if (!loc.latitude || !loc.longitude) continue;
      const pt = this.project(loc.latitude, loc.longitude);
      const dist = Math.hypot(pt.x - x, pt.y - y);
      if (dist <= 16) return ev;
    }
    return null;
  }

  showPopup(ev) {
    this.selectedEvent = ev;
    const loc = ev.location || {};
    const pt = this.project(loc.latitude, loc.longitude);
    const popup = el("gis-popup-card");
    if (!popup) return;

    const eventType = ev.event_type || "HAZARD";
    const addr = loc.address?.formatted || `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
    const conf = ((ev.fusion?.confidence || 0) * 100).toFixed(0);
    const speed = (ev.gps?.speed_kmh || 0).toFixed(1);

    let pinColor = "#0e9177";
    if (eventType === "POTHOLE") pinColor = "#f97316";
    else if (eventType === "WATERLOGGED") pinColor = "#0284c7";
    else if (eventType === "NEAR_MISS") pinColor = "#ef634f";
    else if (eventType === "MISSING_DIVIDER") pinColor = "#a855f7";

    let extraDetail = "";
    if (eventType === "WATERLOGGED" || ev.ultrasonic || ev.waterlogged_details) {
      const us = ev.ultrasonic || ev.waterlogged_details || {};
      const depth = parseFloat(us.water_depth_cm || 0);
      const isAbove = us.above_bumper !== false && (us.above_bumper || depth >= 35.0);
      extraDetail = `Sonar Depth: <b>${depth.toFixed(1)}cm</b> (${isAbove ? '<span style="color:#ef4444; font-weight:800;">ABOVE BUMPER</span>' : '<span style="color:#10b981;">Below Bumper</span>'})`;
    } else if (eventType === "POTHOLE" && ev.pothole_details) {
      extraDetail = `Severity: <b>${safe(ev.pothole_details.severity || "MODERATE")}</b>`;
    } else if (eventType === "NEAR_MISS" && ev.near_miss_details) {
      extraDetail = `Risk: <b>${safe(ev.near_miss_details.risk_level || "WARNING")}</b> (TTC: ${ev.near_miss_details.ttc_seconds || "—"}s)`;
    } else if (eventType === "MISSING_DIVIDER" && ev.divider_details) {
      extraDetail = `Gap: <b>${safe(ev.divider_details.estimated_gap_meters || "—")}m</b>`;
    }

    const isCitizen = ev.bus_id === 'CITIZEN_PORTAL' || Boolean(ev.citizen_details);
    const photoUrl = (ev.evidence && ev.evidence.thumbnail_url) || (ev.citizen_details && ev.citizen_details.photo_url);
    const citizenDesc = ev.citizen_details?.description || "";
    const reporter = ev.citizen_details?.reporter_name || "Citizen";
    const timeInfo = formatDetectionTime(ev.timestamp || ev.last_reported_at || ev.created_at);

    let photoHtml = "";
    if (photoUrl) {
      photoHtml = `<div class="popup-photo-container"><a href="${photoUrl}" target="_blank" title="Click to view full photo evidence"><img src="${photoUrl}" alt="Evidence" onerror="this.parentElement.style.display='none'" /></a></div>`;
    }

    popup.innerHTML = `
      <button class="gis-popup-close" onclick="fallbackGisMap.closePopup()">&times;</button>
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
        <span style="background:${pinColor}; color:#fff; font-size:10px; font-weight:700; padding:2px 7px; border-radius:4px; text-transform:uppercase;">
          ${safe(eventType.replaceAll("_", " "))}
        </span>
        <span style="font-size:10.5px; color:var(--muted); font-family:'DM Mono',monospace;">🕒 ${safe(timeInfo.fullFormatted)}</span>
      </div>
      <div style="font-weight:700; font-size:13px; margin-bottom:4px; line-height:1.3;">${safe(addr)}</div>
      <div style="font-size:11.5px; color:var(--muted); margin-bottom:4px;">
        Source: <b style="color:var(--ink);">${isCitizen ? `👤 Citizen (${safe(reporter)})` : `Bus ${safe(ev.bus_id)}`}</b> · AI: <b style="color:var(--ink);">${conf}%</b>
      </div>
      ${citizenDesc ? `<div style="font-size:11px; color:var(--ink); margin-bottom:4px; font-style:italic;">"${safe(citizenDesc)}"</div>` : ''}
      ${extraDetail ? `<div style="font-size:11.5px; color:var(--ink); margin-bottom:4px;">${extraDetail}</div>` : ""}
      ${photoHtml}
      <div style="font-size:11px; font-family:sans-serif; color:var(--ink); font-weight:700; border-top:1px solid var(--line); padding-top:6px; margin-top:6px; display:flex; align-items:center; justify-content:space-between;">
        <span>Status:</span>
        <select class="status-select" onchange="updateIncidentStatus('${safe(ev.event_id)}', this.value)" style="padding:2px 6px; font-size:11px;">
          <option value="NEW" ${ev.status === 'NEW' ? 'selected' : ''}>⏳ Unreviewed</option>
          <option value="UNDER_REVIEW" ${ev.status === 'UNDER_REVIEW' ? 'selected' : ''}>🔄 Under Process</option>
          <option value="ACTIONED" ${ev.status === 'ACTIONED' ? 'selected' : ''}>✅ Actioned</option>
          <option value="DISMISSED" ${ev.status === 'DISMISSED' ? 'selected' : ''}>✕ Dismissed</option>
        </select>
      </div>
    `;

    popup.style.left = `${pt.x}px`;
    popup.style.top = `${pt.y}px`;
    popup.style.display = "block";
  }

  closePopup() {
    this.selectedEvent = null;
    const popup = el("gis-popup-card");
    if (popup) popup.style.display = "none";
  }

  animate() {
    this.pulsePhase = (this.pulsePhase + 0.05) % (Math.PI * 2);
    if (this.events.length > 0) {
      this.render();
    }
    requestAnimationFrame(this.animate);
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    if (!w || !h) return;

    const isDark = document.body.classList.contains("dark-mode");

    // Palette
    const bg = isDark ? "#0d1815" : "#edf3ef";
    const gridColor = isDark ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.04)";
    const riverColor = isDark ? "#16344d" : "#bfdbfe";
    const riverBorder = isDark ? "#1d476b" : "#93c5fd";
    const roadMajor = isDark ? "#1c3830" : "#d3dfd7";
    const roadBorder = isDark ? "#285246" : "#b8cbc0";
    const roadCorridor = isDark ? "#244d41" : "#c4d5cb";
    const textColor = isDark ? "#7ba699" : "#577167";

    // Clear Canvas
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Subtle Coordinate Grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 60) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Hooghly River Geometry
    const riverPath = [
      [22.66, 88.36], [22.63, 88.355], [22.605, 88.352], [22.585, 88.342],
      [22.565, 88.332], [22.545, 88.322], [22.525, 88.312], [22.49, 88.295]
    ];
    this.drawCurvedFeature(riverPath, riverColor, 22);
    this.drawCurvedFeature(riverPath, riverBorder, 22, true);

    // Major Kolkata Corridors (Base Infrastructure)
    // 1. EM Bypass
    this.drawRoad([[22.605, 88.405], [22.575, 88.398], [22.545, 88.397], [22.515, 88.395], [22.475, 88.388]], roadCorridor, 7);
    // 2. Maa Flyover
    this.drawRoad([[22.545, 88.397], [22.543, 88.368], [22.538, 88.345]], roadMajor, 5);
    // 3. Central Avenue
    this.drawRoad([[22.605, 88.375], [22.585, 88.368], [22.565, 88.352], [22.543, 88.350]], roadMajor, 5);
    // 4. Strand Road & Howrah Approach
    this.drawRoad([[22.595, 88.352], [22.585, 88.342], [22.570, 88.344], [22.552, 88.332]], roadMajor, 5);
    // 5. Salt Lake Sector V Corridor
    this.drawRoad([[22.575, 88.398], [22.573, 88.433], [22.585, 88.455]], roadMajor, 5);
    // 6. VIP Road
    this.drawRoad([[22.605, 88.405], [22.635, 88.428], [22.640, 88.442]], roadMajor, 5);
    // 7. Bridges
    this.drawRoad([[22.555, 88.322], [22.552, 88.332], [22.550, 88.342]], "#38bdf8", 4);
    this.drawRoad([[22.585, 88.342], [22.585, 88.350]], "#38bdf8", 4);




    // Corridor and District Labels
    ctx.font = '10px "DM Mono", monospace';
    ctx.fillStyle = textColor;
    this.drawLabel("Howrah", 22.588, 88.335);
    this.drawLabel("Central / BBD Bagh", 22.571, 88.348);
    this.drawLabel("Salt Lake Sector V", 22.575, 88.435);
    this.drawLabel("EM Bypass Corridor", 22.560, 88.402);
    this.drawLabel("Park Circus", 22.542, 88.365);
    this.drawLabel("Science City", 22.538, 88.399);

    // Render Event Markers
    const pulseScale = Math.sin(this.pulsePhase);
    this.events.forEach(ev => {
      const loc = ev.location || {};
      if (!loc.latitude || !loc.longitude) return;
      const pt = this.project(loc.latitude, loc.longitude);
      if (pt.x < -30 || pt.x > w + 30 || pt.y < -30 || pt.y > h + 30) return;

      const type = ev.event_type || "HAZARD";
      let color = "#0e9177";
      if (type === "POTHOLE") color = "#f97316";
      else if (type === "WATERLOGGED") color = "#0284c7";
      else if (type === "NEAR_MISS") color = "#ef634f";
      else if (type === "MISSING_DIVIDER") color = "#a855f7";

      // Pulsing outer halo
      const haloRadius = 14 + 5 * pulseScale;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, haloRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.22 - 0.1 * pulseScale;
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Outer marker border
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      // Inner Icon (Exclamation mark)
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px Manrope, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", pt.x, pt.y);

      // Badge Label below pin
      ctx.font = '9px "DM Mono", monospace';
      ctx.fillStyle = isDark ? "#dce8e3" : "#10231f";
      const isCitizen = ev.bus_id === 'CITIZEN_PORTAL' || Boolean(ev.citizen_details);
      const label = isCitizen ? (ev.citizen_details?.reporter_name ? `👤 ${ev.citizen_details.reporter_name}` : '👤 Citizen') : `Bus ${ev.bus_id || ""}`;
      ctx.fillText(label, pt.x, pt.y + 16);
    });

    // Reposition active popup if selected
    if (this.selectedEvent) {
      const loc = this.selectedEvent.location || {};
      if (loc.latitude && loc.longitude) {
        const pt = this.project(loc.latitude, loc.longitude);
        const popup = el("gis-popup-card");
        if (popup) {
          popup.style.left = `${pt.x}px`;
          popup.style.top = `${pt.y}px`;
        }
      }
    }
  }

  drawCurvedFeature(points, color, width, isStroke = false) {
    const ctx = this.ctx;
    if (points.length < 2) return;
    ctx.beginPath();
    const p0 = this.project(points[0][0], points[0][1]);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < points.length; i++) {
      const pt = this.project(points[i][0], points[i][1]);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  drawRoad(points, color, width) {
    this.drawCurvedFeature(points, color, width);
  }

  drawLabel(text, lat, lng) {
    const pt = this.project(lat, lng);
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(text, pt.x, pt.y);
  }
}

// ══════════════════════════════════════════════════════════════════════
// 2. Map Initialisation (Mappls SDK with Vector GIS Fallback)
// ══════════════════════════════════════════════════════════════════════
async function initialiseMap() {
  const container = el("city-map");
  if (!container) return;

  function tryInitMappls() {
    if (typeof mappls !== "undefined" && mappls.Map) {
      try {
        container.innerHTML = "";
        try {
          cityMap = new mappls.Map("city-map", {
            center: { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] },
            zoom: DEFAULT_ZOOM,
            zoomControl: true,
            traffic: true,
          });
        } catch (e1) {
          cityMap = new mappls.Map("city-map", {
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            zoomControl: true,
            traffic: true,
          });
        }

        if (cityMap && cityMap.addListener) {
          cityMap.addListener("load", () => {
            console.log("Official Mappls Map SDK loaded successfully");
            renderEvents();
          });
        } else {
          renderEvents();
        }
        return true;
      } catch (err) {
        console.warn("Mappls map initialization:", err);
      }
    }
    return false;
  }

  // 1. Immediately boot the Vector GIS Map so the container is never blank
  if (!cityMap && !fallbackGisMap) {
    fallbackGisMap = new KolkataGISMap("city-map");
    renderEvents();
  }

  // 2. If Mappls SDK is already available, upgrade to it immediately
  if (tryInitMappls()) return;

  // 3. Try loading dynamic Mappls token from backend if available
  try {
    const tokenRes = await fetch(`${API}/mappls/token`).catch(() => null);
    if (tokenRes && tokenRes.ok) {
      const data = await tokenRes.json();
      if (data.token) {
        activeMapplsKey = data.token;
        const script = document.createElement("script");
        script.src = `https://sdk.mappls.com/map/sdk/web?v=3.0&access_token=${encodeURIComponent(data.token)}`;
        script.onload = () => {
          tryInitMappls();
        };
        script.onerror = () => {
          console.log("Mappls script rejected or timed out, Vector GIS remains active.");
          if (fallbackGisMap) {
            fallbackGisMap.resize();
            fallbackGisMap.render();
          }
        };
        document.head.appendChild(script);
      }
    }
  } catch (err) {
    console.log("Vector GIS active:", err);
  }

  // 4. Poll for window.mappls in case static script tag is still downloading
  let attempts = 0;
  const pollInterval = setInterval(() => {
    attempts++;
    if (typeof mappls !== "undefined" && mappls.Map) {
      clearInterval(pollInterval);
      if (tryInitMappls()) {
        fallbackGisMap = null;
      }
    } else if (attempts >= 10) {
      clearInterval(pollInterval);
    }
  }, 400);
}

function removeMapplsMarkers() {
  eventMarkers.forEach(marker => {
    try {
      if (typeof marker.remove === "function") marker.remove();
      else if (window.mappls?.remove) mappls.remove({ map: cityMap, layer: marker });
    } catch(e){}
  });
  eventMarkers = [];
}

function renderMapplsMarkers(events) {
  // If running official Mappls SDK
  if (cityMap && window.mappls && mappls.Marker) {
    removeMapplsMarkers();
    events.forEach(event => {
      const loc = event.location || {};
      if (!loc.latitude || !loc.longitude) return;

      const eventType = event.event_type || "HAZARD";
      const addr = loc.address?.formatted || `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
      const conf = ((event.fusion?.confidence || 0) * 100).toFixed(0);

      let pinColor = "#0e9177";
      if (eventType === "POTHOLE") pinColor = "#f97316";
      else if (eventType === "WATERLOGGED") pinColor = "#0284c7";
      else if (eventType === "NEAR_MISS") pinColor = "#ef634f";
      else if (eventType === "MISSING_DIVIDER") pinColor = "#a855f7";

      const evStatus = event.status || "NEW";
      const isCitizen = event.bus_id === "CITIZEN_PORTAL" || Boolean(event.citizen_details);
      const photoUrl = event.citizen_details?.photo_url || event.evidence?.thumbnail_url;
      const reporterName = event.citizen_details?.reporter_name || (isCitizen ? "Anonymous Citizen" : null);
      const timeInfo = formatDetectionTime(event.timestamp || event.last_reported_at || event.created_at);

      const isWaterlogged = event.event_type === "WATERLOGGED" || Boolean(event.ultrasonic) || Boolean(event.waterlogged_details);
      const usData = event.ultrasonic || event.waterlogged_details || {};
      const usDepth = parseFloat(usData.water_depth_cm || 0);
      const usAbove = usData.above_bumper !== false && (usData.above_bumper === true || usDepth >= 35.0);

      const popupContent = `
        <div style="font-family:'Manrope',sans-serif; font-size:12px; line-height:1.5; max-width:280px; color:#10231f;">
          <span style="background:${pinColor}; color:#fff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:3px; display:inline-block; margin-bottom:4px;">
            ${safe(eventType.replaceAll("_", " "))}
          </span>
          <div style="font-weight:700; font-size:13px; margin:4px 0 3px;">${safe(addr)}</div>
          <div>Source: <b>${isCitizen ? '👤 Citizen Report' : `Bus ${safe(event.bus_id)}`}</b> · Conf: <b>${conf}%</b></div>
          ${reporterName ? `<div>Reporter: <b>${safe(reporterName)}</b></div>` : ''}
          <div>Severity: <b>${safe(severity(event))}</b></div>
          ${isWaterlogged ? `
            <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:6px; padding:6px 8px; margin:6px 0;">
              <div style="font-weight:700; color:#0369a1; font-size:11px;">📡 Ultrasonic Sonar Telemetry:</div>
              <div style="font-size:13px; font-weight:800; color:#0c4a6e; margin:2px 0;">
                ${usDepth.toFixed(1)} cm
                <span style="font-size:10px; font-weight:700; padding:1px 5px; border-radius:3px; background:${usAbove ? '#ef4444' : '#10b981'}; color:#fff; margin-left:4px;">
                  ${usAbove ? '🚨 ABOVE BUMPER (35cm)' : '✓ Safe Clearance'}
                </span>
              </div>
              <div style="font-size:10px; color:#475569;">Clearance Limit: 35.0 cm · Sensor: <code>${safe(usData.sensor_id || 'US-SONAR-01')}</code></div>
            </div>
          ` : ''}
          ${photoUrl ? `
            <div style="margin:6px 0;">
              <a href="${photoUrl}" target="_blank" style="display:block; text-decoration:none;">
                <img src="${photoUrl}" style="width:100%; height:90px; object-fit:cover; border-radius:4px; border:1px solid #cbd5e1;" alt="Evidence Photo">
                <span style="display:block; font-size:10px; color:#0e9177; font-weight:700; margin-top:2px;">📸 View Full Photo Evidence ↗</span>
              </a>
            </div>
          ` : ''}
          <div style="margin-top:6px; padding-top:6px; border-top:1px solid #e2e8f0; display:flex; align-items:center; justify-content:space-between;">
            <span style="font-size:11px; font-weight:700;">Status:</span>
            <select class="status-select" onchange="updateIncidentStatus('${safe(event.event_id)}', this.value)" style="padding:2px 6px; font-size:11px;">
              <option value="NEW" ${evStatus === 'NEW' ? 'selected' : ''}>⏳ Unreviewed</option>
              <option value="UNDER_REVIEW" ${evStatus === 'UNDER_REVIEW' ? 'selected' : ''}>🔄 Under Process</option>
              <option value="ACTIONED" ${evStatus === 'ACTIONED' ? 'selected' : ''}>✅ Actioned</option>
              <option value="DISMISSED" ${evStatus === 'DISMISSED' ? 'selected' : ''}>✕ Dismissed</option>
            </select>
          </div>
          <div style="color:#6f817c; font-size:10px; margin-top:5px; font-family:'DM Mono',monospace;">🕒 Detected: <b>${safe(timeInfo.fullFormatted)}</b> ${timeInfo.relative ? `(${timeInfo.relative})` : ''}</div>
        </div>
      `;

      try {
        const marker = new mappls.Marker({
          map: cityMap,
          position: { lat: loc.latitude, lng: loc.longitude },
          popupHtml: popupContent,
        });
        eventMarkers.push(marker);
      } catch (err) {
        console.warn("Mappls Marker creation:", err);
      }
    });
    return;
  }

  // If running Vector GIS Canvas
  if (fallbackGisMap) {
    fallbackGisMap.setEvents(events);
  }
}

// ══════════════════════════════════════════════════════════════════════
// 3. UI, Metrics & Incident Ledger
// ══════════════════════════════════════════════════════════════════════
function showToast(msg) {
  let toast = el("status-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "status-toast";
    toast.className = "status-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 3200);
}

async function updateIncidentStatus(eventId, newStatus) {
  try {
    const res = await fetch(`${API}/events/${eventId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-citypulse-role": "TRANSPORT_AUTHORITY"
      },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Status update failed");
    }

    // Update local event memory
    const item = allEvents.find(e => (e.event_id === eventId || e.id === eventId));
    if (item) {
      item.status = newStatus;
    }

    const label = newStatus === "NEW" ? "Unreviewed" : newStatus === "UNDER_REVIEW" ? "Under Process" : newStatus === "ACTIONED" ? "Actioned" : "Dismissed";
    showToast(`✓ Alert updated: ${label}`);

    // Refresh metrics counters
    const statsRes = await fetch(`${API}/events/stats`).catch(() => null);
    if (statsRes && statsRes.ok) {
      renderStats(await statsRes.json());
    }

    renderEvents();
  } catch (err) {
    console.error("Workflow status update failed:", err);
    alert("Could not update status: " + err.message);
  }
}
window.updateIncidentStatus = updateIncidentStatus;

function tick() {
  const clock = el("clock");
  if (clock) {
    clock.textContent = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium" }).format(new Date());
  }
}

function severity(event) {
  if (event.event_type === "WATERLOGGED" || event.ultrasonic || event.waterlogged_details) {
    const us = event.ultrasonic || event.waterlogged_details || {};
    const depth = parseFloat(us.water_depth_cm || 0);
    const clearance = parseFloat(us.bumper_clearance_cm || 35.0);
    if (us.above_bumper || depth >= clearance) return "SEVERE";
    if (event.severity) return event.severity;
    return depth >= 15.0 ? "MODERATE" : "LOW";
  }
  return event.severity || event.near_miss_details?.risk_level || event.pothole_details?.severity || event.divider_details?.hazard_level || "MODERATE";
}

function filteredEvents() {
  const typeEl = el("type-filter");
  const statusEl = el("status-filter");
  const sourceEl = el("source-filter");
  const type = typeEl ? typeEl.value : "";
  const status = statusEl ? statusEl.value : "";
  const source = sourceEl ? sourceEl.value : "";

  return allEvents.filter(event => {
    if (type && event.event_type !== type) return false;
    if (status && event.status !== status) return false;
    if (source === "CITIZEN" && event.bus_id !== "CITIZEN_PORTAL" && !event.citizen_details) return false;
    if (source === "BUS" && (event.bus_id === "CITIZEN_PORTAL" || event.citizen_details)) return false;
    return true;
  }).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
}

function renderEvents() {
  const events = filteredEvents();
  renderMapplsMarkers(events);

  const rowsEl = el("incident-rows");
  if (!rowsEl) return;

  rowsEl.innerHTML = events.slice(0, 50).map(event => {
    const loc = event.location || {};
    const addr = loc.address?.formatted || `${(loc.latitude||0).toFixed(4)}, ${(loc.longitude||0).toFixed(4)}`;
    const conf = ((event.fusion?.confidence || 0) * 100).toFixed(0);
    const evStatus = event.status || "NEW";
    const statusLabel = evStatus === "NEW" ? "Unreviewed" : evStatus === "UNDER_REVIEW" ? "Under Process" : evStatus === "ACTIONED" ? "Actioned" : "Dismissed";
    const isCitizen = event.bus_id === "CITIZEN_PORTAL" || Boolean(event.citizen_details);
    const photoUrl = event.citizen_details?.photo_url || event.evidence?.thumbnail_url;
    const reporterName = event.citizen_details?.reporter_name;
    const desc = event.citizen_details?.description;
    const timeInfo = formatDetectionTime(event.timestamp || event.last_reported_at || event.created_at);

    // Sensor Telemetry & Ultrasonic formatting
    let telemetryHtml = "";
    const isWaterlogged = event.event_type === "WATERLOGGED" || Boolean(event.ultrasonic) || Boolean(event.waterlogged_details);
    if (isWaterlogged) {
      const us = event.ultrasonic || event.waterlogged_details || {};
      const depth = parseFloat(us.water_depth_cm || 0).toFixed(1);
      const clearance = parseFloat(us.bumper_clearance_cm || 35.0).toFixed(1);
      const isAbove = us.above_bumper !== false && (us.above_bumper === true || parseFloat(depth) >= parseFloat(clearance));
      const overflow = (parseFloat(depth) - parseFloat(clearance)).toFixed(1);
      telemetryHtml = `
        <div class="telemetry-sonar-wrap ${isAbove ? 'flood-critical' : 'flood-safe'}">
          <div class="sonar-pill-top">
            <span class="sonar-icon-pulse">📡</span>
            <span class="sonar-depth-badge"><b>${depth}</b> cm</span>
            <span class="sonar-verdict ${isAbove ? 'verdict-critical' : 'verdict-safe'}">
              ${isAbove ? `🚨 ABOVE BUMPER (+${overflow}cm)` : '✓ Below Bumper'}
            </span>
          </div>
          <div class="sonar-pill-bottom">
            <span>Limit: ${clearance}cm</span> · <span>Unit: <code>${safe(us.sensor_id || 'US-SONAR-01')}</code></span>
          </div>
        </div>
      `;
    } else if (event.event_type === "POTHOLE" || event.pothole_details) {
      const shock = event.imu?.shock_detected || event.pothole_details?.wheel_impact_confirmed;
      const z = (event.imu?.acceleration_z || 1.0).toFixed(2);
      telemetryHtml = `
        <div class="telemetry-sensor-wrap">
          <span class="sensor-pill ${shock ? 'pill-shock' : 'pill-normal'}">${shock ? '💥 Wheel Shock' : '✓ IMU Normal'}</span>
          <div class="sensor-pill-sub">Z-Axis: <b>${z}g</b></div>
        </div>
      `;
    } else if (event.event_type === "NEAR_MISS" || event.near_miss_details) {
      const harsh = event.near_miss_details?.emergency_braking;
      const spd = (event.gps?.speed_kmh || 0).toFixed(0);
      telemetryHtml = `
        <div class="telemetry-sensor-wrap">
          <span class="sensor-pill ${harsh ? 'pill-brake' : 'pill-normal'}">${harsh ? '🛑 Deceleration Shock' : '⚠️ Forward TTC'}</span>
          <div class="sensor-pill-sub">GPS Speed: <b>${spd} km/h</b></div>
        </div>
      `;
    } else if (event.event_type === "MISSING_DIVIDER" || event.divider_details) {
      const gap = event.divider_details?.estimated_gap_meters || "2-4";
      telemetryHtml = `
        <div class="telemetry-sensor-wrap">
          <span class="sensor-pill pill-barrier">🚧 Missing Median</span>
          <div class="sensor-pill-sub">Gap: <b>~${gap}m</b></div>
        </div>
      `;
    } else {
      telemetryHtml = `
        <div class="telemetry-sensor-wrap">
          <span class="sensor-pill pill-citizen">👤 Citizen Verified</span>
          <div class="sensor-pill-sub">GPS Geofenced</div>
        </div>
      `;
    }

    return `
      <tr class="${isCitizen ? 'citizen-report-row' : ''}">
        <td>
          <span class="alert-name">${safe(event.event_type.replaceAll("_", " "))}</span>
          <span class="alert-meta">
            ${safe(severity(event))} · ${isCitizen ? '👤 <b>Citizen Report</b>' : `Bus ${safe(event.bus_id)}`}
            ${reporterName ? ` · <span style="color:#0e9177;">by ${safe(reporterName)}</span>` : ''}
          </span>
          ${desc ? `<div style="font-size:11px; color:#475569; margin-top:2px; font-style:italic;">"${safe(desc)}"</div>` : ''}
          ${photoUrl ? `
            <div style="margin-top:4px;">
              <a href="${photoUrl}" target="_blank" class="table-photo-link">
                <img src="${photoUrl}" class="table-photo-thumb" alt="Evidence thumbnail">
                <span>📸 Photo Evidence ↗</span>
              </a>
            </div>
          ` : ''}
        </td>
        <td class="timestamp-cell">
          <div class="incident-date">📅 <b>${timeInfo.date}</b></div>
          <div class="incident-time">⏰ <code>${timeInfo.time}</code></div>
          ${timeInfo.relative ? `<span class="time-relative-chip">${timeInfo.relative}</span>` : ''}
        </td>
        <td>${safe(addr)}</td>
        <td class="telemetry-cell">${telemetryHtml}</td>
        <td>${conf}%</td>
        <td>
          <div class="status-action-wrap">
            <span class="badge ${safe(evStatus)}">${statusLabel}</span>
            <select class="status-select" onchange="updateIncidentStatus('${safe(event.event_id || event.id)}', this.value)" title="Change status">
              <option value="NEW" ${evStatus === 'NEW' ? 'selected' : ''}>⏳ Unreviewed</option>
              <option value="UNDER_REVIEW" ${evStatus === 'UNDER_REVIEW' ? 'selected' : ''}>🔄 Under Process</option>
              <option value="ACTIONED" ${evStatus === 'ACTIONED' ? 'selected' : ''}>✅ Actioned</option>
              <option value="DISMISSED" ${evStatus === 'DISMISSED' ? 'selected' : ''}>✕ Dismissed</option>
            </select>
            ${evStatus === 'NEW' ? `<button class="btn-action-sm" onclick="updateIncidentStatus('${safe(event.event_id || event.id)}', 'UNDER_REVIEW')" title="Move to Under Process">Review</button>` : ''}
            ${evStatus === 'UNDER_REVIEW' ? `<button class="btn-action-sm resolve" onclick="updateIncidentStatus('${safe(event.event_id || event.id)}', 'ACTIONED')" title="Mark Resolved">Resolve</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join("") || '<tr><td colspan="6" class="empty">No events match active filters.</td></tr>';
}

async function triggerUltrasonicSimulation(forceAbove = false) {
  const simBtn = el("sim-ultrasonic-btn");
  const floodBtn = el("sim-flood-btn");
  if (simBtn) simBtn.disabled = true;
  if (floodBtn) floodBtn.disabled = true;

  try {
    showToast("📡 Emitting 40kHz ultrasonic echo pulse…");
    const query = forceAbove ? "?force_above_bumper=true" : "";
    const res = await fetch(`${API}/sensors/ultrasonic/simulate${query}`, { method: "POST" });
    if (!res.ok) throw new Error("Ultrasonic simulation endpoint failed");
    const data = await res.json();

    const depth = data.water_depth_cm;
    const clearance = data.bumper_clearance_cm || 35.0;
    const isAbove = data.above_bumper;
    const overflow = data.clearance_overflow_cm || 0;

    // Update Ultrasonic Sonar HUD panel
    if (el("sonar-depth-val")) el("sonar-depth-val").textContent = depth;
    if (el("sonar-gauge-fill")) {
      const pct = Math.min(100, Math.max(5, (depth / 70) * 100));
      el("sonar-gauge-fill").style.width = `${pct}%`;
      el("sonar-gauge-fill").style.background = isAbove ? "#ef4444" : "#0284c7";
    }

    if (el("sonar-risk-badge")) {
      el("sonar-risk-badge").textContent = isAbove ? "🚨 CRITICAL FLOOD" : "NORMAL DEPTH";
      el("sonar-risk-badge").className = isAbove ? "badge SEVERE" : "badge NEW";
    }

    if (el("sonar-bumper-status")) {
      el("sonar-bumper-status").innerHTML = isAbove 
        ? `<span style="color:#ef4444; font-weight:800;">🚨 ABOVE BUMPER (+${overflow}cm)</span>`
        : `<span style="color:#10b981; font-weight:800;">✓ SAFE CLEARANCE</span>`;
    }

    if (el("sonar-deficit-text")) {
      el("sonar-deficit-text").textContent = isAbove
        ? `Water depth ${depth}cm exceeds ${clearance}cm bus bumper threshold (+${overflow}cm overflow)!`
        : `Water depth ${depth}cm is safely below ${clearance}cm bumper limit.`;
    }

    if (el("sonar-corridor-text")) {
      el("sonar-corridor-text").textContent = `Corridor: ${data.corridor_name || 'Central Transit route'}`;
    }

    if (el("sonar-dispatch-state")) {
      el("sonar-dispatch-state").innerHTML = isAbove
        ? `<span style="color:#ef4444; font-weight:700;">DISPATCHED: WATERLOGGED</span>`
        : `<span style="color:#10b981; font-weight:700;">Telemetry Logged</span>`;
    }

    if (el("sonar-last-event")) {
      el("sonar-last-event").textContent = isAbove
        ? `Logged alert ${data.event_id?.slice(0, 8)}... to municipal register`
        : `Depth ${depth}cm logged to edge bus telemetry stream`;
    }

    if (el("sonar-last-time")) {
      el("sonar-last-time").textContent = `Last ping: ${new Date().toLocaleTimeString()}`;
    }

    if (isAbove) {
      showToast(`🚨 FLOOD ALERT! Sonar detected ${depth}cm water level > 35cm bumper limit!`);
    } else {
      showToast(`✓ Sonar ping: ${depth}cm water level (Safe below 35cm bumper).`);
    }

    // Refresh events from backend to show the new alert in table & map
    await load();
  } catch (err) {
    console.error("Ultrasonic simulation failed:", err);
    showToast(`Simulation error: ${err.message}`);
  } finally {
    if (simBtn) simBtn.disabled = false;
    if (floodBtn) floodBtn.disabled = false;
  }
}
window.triggerUltrasonicSimulation = triggerUltrasonicSimulation;

function renderStats(stats) {
  const byStatus = stats.by_status || {};
  if (el("total-events")) el("total-events").textContent = stats.total_events || 0;
  if (el("new-events")) el("new-events").textContent = byStatus.NEW || 0;
  if (el("review-events")) el("review-events").textContent = byStatus.UNDER_REVIEW || 0;
  if (el("actioned-events")) el("actioned-events").textContent = byStatus.ACTIONED || 0;
  if (el("active-buses")) el("active-buses").textContent = stats.buses_reporting?.length || 0;

  const typeCounts = stats.by_type || {};
  const maximum = Math.max(1, ...Object.values(typeCounts));
  const typeBarsEl = el("type-bars");
  if (typeBarsEl) {
    typeBarsEl.innerHTML = Object.entries(typeCounts).map(([name, count]) => `
      <div class="bar-line">
        <span>${safe(name.replaceAll("_", " "))}</span>
        <div class="bar-track"><div class="bar" style="width:${(count / maximum) * 100}%"></div></div>
        <strong>${count}</strong>
      </div>
    `).join("") || '<div class="empty">No hazard signals logged yet.</div>';
  }
}

function populateTypes() {
  const filter = el("type-filter");
  if (!filter) return;
  const selected = filter.value;
  const types = [...new Set(allEvents.map(e => e.event_type))].sort();
  filter.innerHTML = '<option value="">All Alert Types</option>' + types.map(t => `<option value="${safe(t)}">${safe(t.replaceAll("_", " "))}</option>`).join("");
  filter.value = selected;
}

async function load() {
  if (el("auth") && !sessionStorage.getItem(ADMIN_STORAGE_KEY)) {
    // Admin portal data is locked until administrative authentication is verified
    return;
  }

  try {
    const token = sessionStorage.getItem(ADMIN_STORAGE_KEY);
    const headers = token ? { "Authorization": `Bearer ${token}` } : {};
    const [eventsRes, statsRes] = await Promise.all([
      fetch(`${API}/events?limit=500`, { headers }),
      fetch(`${API}/events/stats`, { headers })
    ]);

    if (!eventsRes.ok || !statsRes.ok) throw Error("Backend API unavailable");

    allEvents = (await eventsRes.json()).events || [];
    renderStats(await statsRes.json());
    populateTypes();
    renderEvents();

    const connStatus = el("connection-status");
    if (connStatus) connStatus.textContent = "Command center & Mappls connected";
    const connEl = document.querySelector(".connection");
    if (connEl) connEl.classList.add("connected");
  } catch (error) {
    const connStatus = el("connection-status");
    if (connStatus) connStatus.textContent = "API offline — start backend to stream live bus data";
    const connEl = document.querySelector(".connection");
    if (connEl) connEl.classList.remove("connected");
    console.error(error);
  }
}

function centerKolkataFleet() {
  let centered = false;
  if (cityMap && cityMap.setCenter) {
    try {
      cityMap.setCenter(DEFAULT_CENTER);
      cityMap.setZoom(DEFAULT_ZOOM);
      centered = true;
    } catch (e) {
      console.warn("Mappls setCenter error:", e);
    }
  }
  if (fallbackGisMap) {
    fallbackGisMap.setCenter(DEFAULT_CENTER, DEFAULT_ZOOM);
    centered = true;
  }
  showToast("✓ Map recentered on Central Kolkata");
}

// ══════════════════════════════════════════════════════════════════════
// 4. Dark Mode Theme Controller
// ══════════════════════════════════════════════════════════════════════
function setTheme(dark) {
  const themeBtn = el("theme-toggle");
  document.body.classList.toggle("dark-mode", dark);
  if (themeBtn) {
    themeBtn.textContent = dark ? "☀️ Light Mode" : "🌙 Dark Mode";
  }
  localStorage.setItem("citypulse-theme", dark ? "dark" : "light");
  if (fallbackGisMap) fallbackGisMap.render();
}

function initTheme() {
  const themeBtn = el("theme-toggle");
  const savedTheme = localStorage.getItem("citypulse-theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = savedTheme === "dark" || (!savedTheme && prefersDark);

  setTheme(isDark);

  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const isCurrentDark = document.body.classList.contains("dark-mode");
      setTheme(!isCurrentDark);
    });
  }
}

// ══════════════════════════════════════════════════════════════════════
// 5. Mappls Key Configuration Modal
// ══════════════════════════════════════════════════════════════════════
function openKeyModal() {
  const modal = el("key-modal");
  const keyInput = el("modal-key-input");
  const cidInput = el("modal-cid-input");
  const secInput = el("modal-sec-input");
  const status = el("modal-key-status");
  if (!modal) return;

  if (keyInput) keyInput.value = "";
  if (cidInput) cidInput.value = "";
  if (secInput) secInput.value = "";
  if (status) {
    status.innerHTML = `<span style="color:#0e9177; font-weight:600;">● Mappls Engine Key Configured &amp; Active (Hidden/Secured)</span>`;
  }
  modal.style.display = "flex";
}

function closeKeyModal() {
  const modal = el("key-modal");
  if (modal) modal.style.display = "none";
}

async function saveMapplsKey() {
  const keyInput = el("modal-key-input");
  const cidInput = el("modal-cid-input");
  const secInput = el("modal-sec-input");
  const status = el("modal-key-status");

  const apiKey = keyInput ? keyInput.value.trim() : "";
  const clientId = cidInput ? cidInput.value.trim() : "";
  const clientSecret = secInput ? secInput.value.trim() : "";

  if (!apiKey && !(clientId && clientSecret)) {
    if (status) status.innerHTML = '<span style="color:var(--coral);">Please enter a REST API Key OR Client ID + Client Secret.</span>';
    return;
  }

  if (status) status.innerHTML = '<span style="color:var(--accent);">Connecting and authenticating with Mappls...</span>';

  try {
    const res = await fetch(`${API}/mappls/config/key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey || null,
        client_id: clientId || null,
        client_secret: clientSecret || null
      })
    });
    const d = await res.json();
    if (d.valid) {
      if (status) status.innerHTML = '<span style="color:#22c55e;">Authentication successful! Loading official Mappls SDK...</span>';
      const token = d.token || apiKey;
      if (token) {
        activeMapplsKey = token;
        localStorage.setItem("mappls_api_key", token);
      }
      setTimeout(() => {
        closeKeyModal();
        location.reload();
      }, 1200);
      return;
    } else {
      if (status) status.innerHTML = `<span style="color:var(--coral);">${safe(d.message)}</span>`;
    }
  } catch(e) {
    if (status) status.innerHTML = `<span style="color:var(--coral);">Backend unreachable: ${safe(e.message)}</span>`;
  }

  // Also test direct client-side script load if key provided
  if (apiKey) {
    const script = document.createElement("script");
    script.src = `https://apis.mappls.com/advancedmaps/api/${encodeURIComponent(apiKey)}/map_sdk?v=3.0&layer=vector`;
    script.onload = () => {
      activeMapplsKey = apiKey;
      localStorage.setItem("mappls_api_key", apiKey);
      setTimeout(() => { closeKeyModal(); location.reload(); }, 800);
    };
    script.onerror = () => {
      if (status) status.innerHTML = '<span style="color:var(--coral);">Mappls rejected key with 401. Running in local Vector GIS mode.</span>';
    };
    document.head.appendChild(script);
  }
}

// Event Listeners
if (el("type-filter")) el("type-filter").addEventListener("change", renderEvents);
if (el("status-filter")) el("status-filter").addEventListener("change", renderEvents);
if (el("source-filter")) el("source-filter").addEventListener("change", renderEvents);
if (el("refresh")) el("refresh").addEventListener("click", load);
if (el("center-map-btn")) el("center-map-btn").addEventListener("click", centerKolkataFleet);
if (el("mappls-key-btn")) el("mappls-key-btn").addEventListener("click", openKeyModal);
if (el("modal-cancel-btn")) el("modal-cancel-btn").addEventListener("click", closeKeyModal);
if (el("modal-save-btn")) el("modal-save-btn").addEventListener("click", saveMapplsKey);




// ══════════════════════════════════════════════════════════════════════
// 5. Admin Security & Encrypted Access Controller
// ══════════════════════════════════════════════════════════════════════
const ADMIN_STORAGE_KEY = "citypulse_admin_token";

function togglePasswordVisibility() {
  const pwd = el("admin-password-input");
  if (!pwd) return;
  pwd.type = pwd.type === "password" ? "text" : "password";
}
window.togglePasswordVisibility = togglePasswordVisibility;

function checkAdminAuth(shouldScroll = false) {
  const authSection = el("auth");
  if (!authSection) return true; // Only applies to admin dashboard (index.html)

  const lockedView = el("auth-locked-view");
  const unlockedView = el("auth-unlocked-view");
  const badgeEl = el("auth-section-badge");
  const connStatus = el("connection-status");
  const connIndicator = el("auth-connection-indicator");
  const gatedSections = document.querySelectorAll(".admin-gated");
  const navAuthLink = el("nav-auth-link");
  const headerStatusChip = el("header-auth-status");
  const lockBtn = el("lock-admin-btn");

  const token = sessionStorage.getItem(ADMIN_STORAGE_KEY);
  const isAuthenticated = Boolean(token);

  if (isAuthenticated) {
    // Reveal all portal data sections
    gatedSections.forEach(s => s.style.display = "");

    // Update Auth Section View
    if (lockedView) lockedView.style.display = "none";
    if (unlockedView) unlockedView.style.display = "block";
    if (badgeEl) {
      badgeEl.className = "badge ACTIONED";
      badgeEl.textContent = "● ACTIVE SESSION (AUTHENTICATED)";
    }

    // Update connection indicator & header status
    if (connStatus) connStatus.textContent = "Command center & Mappls connected (Admin Active)";
    if (connIndicator) connIndicator.classList.add("connected");
    if (headerStatusChip) {
      headerStatusChip.className = "badge ACTIONED";
      headerStatusChip.innerHTML = "● Admin: Verified";
    }
    if (lockBtn) {
      lockBtn.style.display = "";
      lockBtn.title = "Lock Admin Portal";
      lockBtn.innerHTML = "🔒 Lock";
    }
    if (navAuthLink) {
      navAuthLink.innerHTML = "🛡️ Admin Session";
    }

    // Recalculate GIS and Map dimensions once container is visible
    setTimeout(() => {
      if (cityMap && cityMap.invalidateSize) {
        cityMap.invalidateSize();
      }
      if (fallbackGisMap && fallbackGisMap.resize) {
        fallbackGisMap.resize();
      }
    }, 120);

    return true;
  } else {
    // Hide all portal data sections until verified
    gatedSections.forEach(s => s.style.display = "none");

    // Update Auth Section View to Login Card
    if (lockedView) lockedView.style.display = "block";
    if (unlockedView) unlockedView.style.display = "none";
    if (badgeEl) {
      badgeEl.className = "badge NEW";
      badgeEl.textContent = "🔒 LOCKED / AUTHENTICATION REQUIRED";
    }

    // Update connection indicator & header status
    if (connStatus) connStatus.textContent = "Admin Authentication Required";
    if (connIndicator) connIndicator.classList.remove("connected");
    if (headerStatusChip) {
      headerStatusChip.className = "badge NEW";
      headerStatusChip.innerHTML = "🔒 Admin: Locked";
    }
    if (lockBtn) {
      lockBtn.style.display = "none";
    }
    if (navAuthLink) {
      navAuthLink.innerHTML = "🔐 Admin Login";
      document.querySelectorAll("nav a").forEach(a => a.classList.remove("active"));
      navAuthLink.classList.add("active");
    }

    const passInput = el("admin-password-input");
    if (passInput) {
      passInput.value = "";
      if (shouldScroll) {
        setTimeout(() => passInput.focus(), 150);
      }
    }

    if (shouldScroll && authSection) {
      authSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    return false;
  }
}

async function handleAdminLogin(event) {
  if (event) event.preventDefault();
  const passInput = el("admin-password-input");
  const errorEl = el("admin-auth-error") || el("admin-lock-error");
  const errorText = el("admin-auth-error-text");
  const unlockBtn = el("admin-unlock-btn");
  if (!passInput) return;

  const password = passInput.value.trim();
  if (!password) {
    if (errorEl) {
      if (errorText) errorText.textContent = "Please enter the administrative password.";
      errorEl.style.display = "flex";
    }
    return;
  }

  if (unlockBtn) {
    unlockBtn.disabled = true;
    unlockBtn.innerHTML = "<span>⏳ Verifying Cryptographic Handshake…</span>";
  }
  if (errorEl) errorEl.style.display = "none";

  try {
    const res = await fetch(`${API}/auth/admin-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Invalid password");
    }

    const data = await res.json();
    sessionStorage.setItem(ADMIN_STORAGE_KEY, data.token || "authenticated");
    passInput.value = "";

    checkAdminAuth();
    initialiseMap();
    await load();
    if (!pollTimer) {
      pollTimer = setInterval(load, 5000);
    }
    showToast("✓ Welcome! Admin Command Center Decrypted & Active.");

    // Smooth scroll to overview metrics and activate Overview in nav
    const overview = el("overview");
    if (overview) {
      overview.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    document.querySelectorAll("nav a").forEach(a => a.classList.remove("active"));
    const navOverview = document.querySelector('nav a[href="#overview"]');
    if (navOverview) navOverview.classList.add("active");
  } catch (err) {
    if (errorEl) {
      if (errorText) {
        errorText.textContent = err.message || "Access Denied: Incorrect administrative security key.";
      }
      errorEl.style.display = "flex";
    }
    passInput.select();
  } finally {
    if (unlockBtn) {
      unlockBtn.disabled = false;
      unlockBtn.innerHTML = "<span>🔓 Authenticate &amp; Unlock Command Center</span>";
    }
  }
}
window.handleAdminLogin = handleAdminLogin;

function lockAdminPortal() {
  sessionStorage.removeItem(ADMIN_STORAGE_KEY);
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  allEvents = [];

  // Reset telemetry counters and incident ledger in DOM
  if (el("total-events")) el("total-events").textContent = "—";
  if (el("new-events")) el("new-events").textContent = "—";
  if (el("review-events")) el("review-events").textContent = "—";
  if (el("actioned-events")) el("actioned-events").textContent = "—";
  if (el("active-buses")) el("active-buses").textContent = "—";
  const rowsEl = el("incident-rows");
  if (rowsEl) {
    rowsEl.innerHTML = '<tr><td colspan="5" class="empty">Admin authentication required to view incident records.</td></tr>';
  }

  checkAdminAuth(true);
  showToast("🔒 Admin portal locked. Session terminated.");
}
window.lockAdminPortal = lockAdminPortal;

function setupNavInteractivity() {
  const navLinks = document.querySelectorAll("nav a");
  navLinks.forEach(link => {
    link.addEventListener("click", e => {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("/") || href.startsWith("http")) return; // External links

      const token = sessionStorage.getItem(ADMIN_STORAGE_KEY);
      if (!token && href !== "#auth") {
        e.preventDefault();
        showToast("🔒 Please authenticate first to access portal data");
        const passInput = el("admin-password-input");
        if (passInput) passInput.focus();
        const auth = el("auth");
        if (auth) auth.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      navLinks.forEach(l => l.classList.remove("active"));
      link.classList.add("active");
    });
  });
}

// Start
let pollTimer = null;
initTheme();
setupNavInteractivity();
tick();
setInterval(tick, 1000);

if (checkAdminAuth()) {
  const token = sessionStorage.getItem(ADMIN_STORAGE_KEY);
  fetch(`${API}/auth/verify?token=${encodeURIComponent(token || "")}`)
    .then(r => r.json())
    .then(data => {
      if (data && data.valid) {
        initialiseMap();
        load();
        if (!pollTimer) pollTimer = setInterval(load, 5000);
      } else {
        lockAdminPortal();
      }
    })
    .catch(() => {
      // Backend temporarily offline, still allow active UI
      initialiseMap();
      load();
      if (!pollTimer) pollTimer = setInterval(load, 5000);
    });
} else {
  // Focus the password input on initial load so admin can log in immediately
  const passInput = el("admin-password-input");
  if (passInput) {
    setTimeout(() => passInput.focus(), 200);
  }
}

import { useEffect, useRef, useCallback } from "react";

const SPEEDS = [-3650, -365, -30, -7, -1, 0, 1, 7, 30, 365, 3650];
const DEFAULT_SPEED_IDX = 6;

// 1 AU = 149,597,870 km
const KM_PER_AU = 149597870;

// Planets: auDist in AU, radiusKm, period in days
const PLANETS = [
  { name: "Mercury", auDist: 0.387,  radiusKm: 2440,   period: 87.97,   color: "#b5b5b5" },
  { name: "Venus",   auDist: 0.723,  radiusKm: 6052,   period: 224.70,  color: "#e8cda0" },
  { name: "Earth",   auDist: 1.000,  radiusKm: 6371,   period: 365.25,  color: "#2a6dd9", hasAtmo: true },
  { name: "Mars",    auDist: 1.524,  radiusKm: 3390,   period: 686.97,  color: "#c1440e" },
  { name: "Jupiter", auDist: 5.203,  radiusKm: 71492,  period: 4332.6,  color: "#c88b3a", bands: true },
  { name: "Saturn",  auDist: 9.537,  radiusKm: 60268,  period: 10759.0, color: "#e4d191", rings: true },
  { name: "Uranus",  auDist: 19.191, radiusKm: 25559,  period: 30688.0, color: "#7de8e8" },
  { name: "Neptune", auDist: 30.069, radiusKm: 24622,  period: 60182.0, color: "#4b70dd" },
];

// Moons: orbitKm from planet center, radiusKm, period in days
const MOONS = {
  Earth: [
    { name: "Moon", orbitKm: 384400, radiusKm: 1737, period: 27.32, color: "#c8c4b0" },
  ],
  Mars: [
    { name: "Phobos", orbitKm: 9376,  radiusKm: 11,   period: 0.319,  color: "#a09080" },
    { name: "Deimos", orbitKm: 23460, radiusKm: 6,    period: 1.263,  color: "#908070" },
  ],
  Jupiter: [
    { name: "Io",       orbitKm: 421800,  radiusKm: 1822, period: 1.769,  color: "#e8d060" },
    { name: "Europa",   orbitKm: 671100,  radiusKm: 1561, period: 3.551,  color: "#c8b898" },
    { name: "Ganymede", orbitKm: 1070400, radiusKm: 2634, period: 7.155,  color: "#a09880" },
    { name: "Callisto", orbitKm: 1882700, radiusKm: 2410, period: 16.69,  color: "#706860" },
  ],
  Saturn: [
    { name: "Mimas",     orbitKm: 185520,  radiusKm: 198,  period: 0.942,  color: "#c8c0b8" },
    { name: "Enceladus", orbitKm: 238020,  radiusKm: 252,  period: 1.370,  color: "#e8e8f0" },
    { name: "Tethys",    orbitKm: 294660,  radiusKm: 533,  period: 1.888,  color: "#d0c8c0" },
    { name: "Dione",     orbitKm: 377400,  radiusKm: 562,  period: 2.737,  color: "#c8c0b0" },
    { name: "Rhea",      orbitKm: 527040,  radiusKm: 764,  period: 4.518,  color: "#c0b8a8" },
    { name: "Titan",     orbitKm: 1221870, radiusKm: 2575, period: 15.95,  color: "#d4a040" },
    { name: "Iapetus",   orbitKm: 3560820, radiusKm: 735,  period: 79.32,  color: "#908878" },
  ],
  Uranus: [
    { name: "Miranda", orbitKm: 129900, radiusKm: 236, period: 1.414,  color: "#b0a898" },
    { name: "Ariel",   orbitKm: 191020, radiusKm: 579, period: 2.520,  color: "#b8b0a0" },
    { name: "Umbriel", orbitKm: 266300, radiusKm: 585, period: 4.144,  color: "#706860" },
    { name: "Titania", orbitKm: 435910, radiusKm: 789, period: 8.706,  color: "#a89880" },
    { name: "Oberon",  orbitKm: 583520, radiusKm: 761, period: 13.46,  color: "#988870" },
  ],
  Neptune: [
    { name: "Triton", orbitKm: 354759, radiusKm: 1353, period: -5.877, color: "#b0c8d0" }, // retrograde
    { name: "Nereid", orbitKm: 5513400, radiusKm: 170, period: 360.1,  color: "#909888" },
  ],
};

const SUN_RADIUS_KM = 695700;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lighten(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.min(255,r+Math.round(255*amt))},${Math.min(255,g+Math.round(255*amt))},${Math.min(255,b+Math.round(255*amt))})`;
}
function darken(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.max(0,r-Math.round(255*amt))},${Math.max(0,g-Math.round(255*amt))},${Math.max(0,b-Math.round(255*amt))})`;
}

export default function SolarSystem() {
  const canvasRef     = useRef(null);
  const timelineRef   = useRef(null);
  const speedLabelRef = useRef(null);

  const state = useRef({
    speedIdx: DEFAULT_SPEED_IDX,
    days: 0,
    zoom: 1,
    // pan is in SCENE space (AU-scaled pixels), not screen space
    // screen center = scene origin + pan
    panX: 0,
    panY: 0,
    following: null, // null | 'sun' | { type:'planet'|'moon', name, parentName? }
    dragging: false,
    didDrag: false,
    dragStartX: 0, dragStartY: 0,
    panStartX: 0,  panStartY: 0,
    lastTouchDist: null,
    lastTs: null,
    rafId: null,
    stars: Array.from({ length: 300 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.2 + 0.2,
      a: Math.random() * 0.5 + 0.2,
    })),
  });

  // pxPerAu at zoom=1: Neptune fits in ~42% of smaller screen dimension
  const getDims = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return {};
    const W = canvas.width, H = canvas.height;
    const pxPerAu = Math.min(W, H) * 0.42 / 30.07;
    return { W, H, pxPerAu };
  }, []);

  // Convert km to AU-space pixels
  const kmToPx = useCallback((km, pxPerAu) => km / KM_PER_AU * pxPerAu, []);

  // Get planet scene position (in AU-space pixels, relative to sun)
  const getPlanetScenePos = useCallback((planet, days) => {
    const angle = (days / planet.period) * Math.PI * 2;
    const r = planet.auDist * /* filled in call */ 1;
    return { angle, ax: Math.cos(angle), ay: Math.sin(angle) };
  }, []);

  // Compute scene-space (pxPerAu-scaled) position of any body
  const getBodyPos = useCallback((target, days, pxPerAu) => {
    if (target === 'sun') return { x: 0, y: 0 };

    if (target.type === 'planet') {
      const planet = PLANETS.find(p => p.name === target.name);
      if (!planet) return { x: 0, y: 0 };
      const angle = (days / planet.period) * Math.PI * 2;
      return {
        x: Math.cos(angle) * planet.auDist * pxPerAu,
        y: Math.sin(angle) * planet.auDist * pxPerAu,
      };
    }

    if (target.type === 'moon') {
      const planet = PLANETS.find(p => p.name === target.parentName);
      const moons  = MOONS[target.parentName] || [];
      const moon   = moons.find(m => m.name === target.name);
      if (!planet || !moon) return { x: 0, y: 0 };
      const pAngle = (days / planet.period) * Math.PI * 2;
      const px = Math.cos(pAngle) * planet.auDist * pxPerAu;
      const py = Math.sin(pAngle) * planet.auDist * pxPerAu;
      const mAngle = (days / moon.period) * Math.PI * 2;
      const orbitPx = kmToPx(moon.orbitKm, pxPerAu);
      return {
        x: px + Math.cos(mAngle) * orbitPx,
        y: py + Math.sin(mAngle) * orbitPx,
      };
    }

    return { x: 0, y: 0 };
  }, [kmToPx]);

  const updateSpeedLabel = useCallback(() => {
    const sp = SPEEDS[state.current.speedIdx];
    if (!speedLabelRef.current) return;
    const abs = Math.abs(sp);
    const dir = sp < 0 ? "−" : sp === 0 ? "" : "+";
    speedLabelRef.current.textContent =
      sp === 0 ? "paused"
      : abs >= 365 ? `${dir}${(abs/365).toFixed(abs >= 3650 ? 0 : 1)}yr/s`
      : `${dir}${abs}d/s`;
  }, []);

  const handleClick = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { W, H, pxPerAu } = getDims();
    const s = state.current;
    const rect = canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * (canvas.width / rect.width);
    const py = (clientY - rect.top)  * (canvas.height / rect.height);
    // Convert to scene space
    const sx = (px - W/2) / s.zoom - s.panX;
    const sy = (py - H/2) / s.zoom - s.panY;

    const sunRvis = Math.min(kmToPx(SUN_RADIUS_KM, pxPerAu), Math.min(W,H)*0.06 / s.zoom);
    if (Math.sqrt(sx*sx + sy*sy) < sunRvis * 2) { s.following = 'sun'; return; }

    // Check moons first (they're smaller, easier to miss)
    for (const planet of PLANETS) {
      const moons = MOONS[planet.name] || [];
      const pAngle = (s.days / planet.period) * Math.PI * 2;
      const planetX = Math.cos(pAngle) * planet.auDist * pxPerAu;
      const planetY = Math.sin(pAngle) * planet.auDist * pxPerAu;
      for (const moon of moons) {
        const mAngle = (s.days / moon.period) * Math.PI * 2;
        const orbitPx = kmToPx(moon.orbitKm, pxPerAu);
        const mx = planetX + Math.cos(mAngle) * orbitPx;
        const my = planetY + Math.sin(mAngle) * orbitPx;
        const mr = Math.max(kmToPx(moon.radiusKm, pxPerAu), 1.5 / s.zoom);
        if (Math.sqrt((sx-mx)**2 + (sy-my)**2) < Math.max(mr*3, 6/s.zoom)) {
          s.following = { type: 'moon', name: moon.name, parentName: planet.name };
          return;
        }
      }
    }

    // Check planets
    let hit = null, bestDist = Infinity;
    for (const planet of PLANETS) {
      const angle = (s.days / planet.period) * Math.PI * 2;
      const bx = Math.cos(angle) * planet.auDist * pxPerAu;
      const by = Math.sin(angle) * planet.auDist * pxPerAu;
      const pr = Math.max(kmToPx(planet.radiusKm, pxPerAu), 1.5 / s.zoom);
      const d = Math.sqrt((sx-bx)**2 + (sy-by)**2);
      if (d < Math.max(pr*3, 8/s.zoom) && d < bestDist) {
        bestDist = d;
        hit = { type: 'planet', name: planet.name };
      }
    }
    s.following = hit;
  }, [getDims, kmToPx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const s = state.current;
    const CONTROLS_H = 52;

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight - CONTROLS_H;
    }
    resize();
    window.addEventListener("resize", resize);

    function onWheel(e) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.18 : 1/1.18;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top)  * (canvas.height / rect.height);
      const { W, H } = getDims();
      // Mouse in scene space before zoom
      const sceneX = (mx - W/2) / s.zoom - s.panX;
      const sceneY = (my - H/2) / s.zoom - s.panY;
      s.zoom = Math.min(50000, Math.max(0.02, s.zoom * factor));
      // Keep scene point under mouse
      s.panX = (mx - W/2) / s.zoom - sceneX;
      s.panY = (my - H/2) / s.zoom - sceneY;
    }
    canvas.addEventListener("wheel", onWheel, { passive: false });

    function onMouseDown(e) {
      s.dragging = true; s.didDrag = false;
      s.dragStartX = e.clientX; s.dragStartY = e.clientY;
      s.panStartX = s.panX; s.panStartY = s.panY;
      canvas.style.cursor = "grabbing";
    }
    function onMouseMove(e) {
      if (!s.dragging) return;
      const dx = e.clientX - s.dragStartX, dy = e.clientY - s.dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) { s.didDrag = true; s.following = null; }
      const rect = canvas.getBoundingClientRect();
      // pan is in scene space: divide screen delta by zoom
      s.panX = s.panStartX + dx * (canvas.width / rect.width) / s.zoom;
      s.panY = s.panStartY + dy * (canvas.height / rect.height) / s.zoom;
    }
    function onMouseUp(e) {
      if (!s.didDrag) handleClick(e.clientX, e.clientY);
      s.dragging = false; canvas.style.cursor = "grab";
    }
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    function onTouchStart(e) {
      if (e.touches.length === 1) {
        s.dragging = true; s.didDrag = false;
        s.dragStartX = e.touches[0].clientX; s.dragStartY = e.touches[0].clientY;
        s.panStartX = s.panX; s.panStartY = s.panY;
      }
      if (e.touches.length === 2) { s.dragging = false; s.lastTouchDist = null; }
    }
    function onTouchMove(e) {
      e.preventDefault();
      if (e.touches.length === 1 && s.dragging) {
        const dx = e.touches[0].clientX - s.dragStartX;
        const dy = e.touches[0].clientY - s.dragStartY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) { s.didDrag = true; s.following = null; }
        const rect = canvas.getBoundingClientRect();
        s.panX = s.panStartX + dx * (canvas.width / rect.width) / s.zoom;
        s.panY = s.panStartY + dy * (canvas.height / rect.height) / s.zoom;
      }
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (s.lastTouchDist !== null) {
          const { W, H } = getDims();
          const factor = dist / s.lastTouchDist;
          // zoom toward pinch midpoint
          const mx = ((e.touches[0].clientX + e.touches[1].clientX) / 2);
          const my = ((e.touches[0].clientY + e.touches[1].clientY) / 2);
          const rect = canvas.getBoundingClientRect();
          const cx = (mx - rect.left) * (canvas.width / rect.width);
          const cy = (my - rect.top)  * (canvas.height / rect.height);
          const sceneX = (cx - W/2) / s.zoom - s.panX;
          const sceneY = (cy - H/2) / s.zoom - s.panY;
          s.zoom = Math.min(50000, Math.max(0.02, s.zoom * factor));
          s.panX = (cx - W/2) / s.zoom - sceneX;
          s.panY = (cy - H/2) / s.zoom - sceneY;
        }
        s.lastTouchDist = dist;
      }
    }
    function onTouchEnd(e) {
      if (!s.didDrag && e.changedTouches.length === 1)
        handleClick(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      s.dragging = false; s.lastTouchDist = null;
    }
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    function drawBody(bx, by, pr, color, opts = {}) {
      const grad = ctx.createRadialGradient(bx - pr*0.3, by - pr*0.3, pr*0.05, bx, by, pr);
      grad.addColorStop(0, lighten(color, 0.35));
      grad.addColorStop(1, darken(color, 0.35));
      ctx.beginPath(); ctx.arc(bx, by, pr, 0, Math.PI*2);
      ctx.fillStyle = grad; ctx.fill();

      if (opts.continents) {
        ctx.save();
        ctx.beginPath(); ctx.arc(bx, by, pr, 0, Math.PI*2); ctx.clip();
        ctx.fillStyle = "rgba(55,150,60,0.65)";
        ctx.beginPath(); ctx.ellipse(bx-pr*.1, by-pr*.2, pr*.38, pr*.27, 0.4, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(bx+pr*.3, by+pr*.1, pr*.22, pr*.32, -0.3, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        const atm = ctx.createRadialGradient(bx, by, pr*.9, bx, by, pr*1.2);
        atm.addColorStop(0, "rgba(100,180,255,0.18)"); atm.addColorStop(1, "transparent");
        ctx.beginPath(); ctx.arc(bx, by, pr*1.2, 0, Math.PI*2); ctx.fillStyle = atm; ctx.fill();
      }

      if (opts.bands) {
        ctx.save();
        ctx.beginPath(); ctx.arc(bx, by, pr, 0, Math.PI*2); ctx.clip();
        [["rgba(160,100,40,0.35)",-0.55],["rgba(220,180,90,0.2)",-0.2],["rgba(160,100,40,0.3)",0.15],["rgba(200,150,70,0.2)",0.45]]
          .forEach(([c,yo]) => { ctx.fillStyle=c; ctx.fillRect(bx-pr, by+yo*pr, pr*2, pr*0.28); });
        ctx.restore();
      }

      if (opts.rings) {
        ctx.save();
        ctx.translate(bx, by); ctx.scale(1, 0.28);
        ctx.beginPath(); ctx.arc(0,0,pr*2.5,0,Math.PI*2); ctx.arc(0,0,pr*1.25,0,Math.PI*2,true);
        ctx.fillStyle = "rgba(200,180,110,0.32)"; ctx.fill();
        ctx.beginPath(); ctx.arc(0,0,pr*2.0,0,Math.PI*2); ctx.arc(0,0,pr*1.6,0,Math.PI*2,true);
        ctx.fillStyle = "rgba(220,200,130,0.18)"; ctx.fill();
        ctx.restore();
      }

      if (opts.glow) {
        const glow = ctx.createRadialGradient(bx, by, pr*.8, bx, by, pr*2.2);
        glow.addColorStop(0, color+"44"); glow.addColorStop(1, "transparent");
        ctx.beginPath(); ctx.arc(bx, by, pr*2.2, 0, Math.PI*2); ctx.fillStyle = glow; ctx.fill();
      }

      if (opts.following) {
        ctx.beginPath(); ctx.arc(bx, by, Math.max(pr*2.2, 4/s.zoom), 0, Math.PI*2);
        ctx.strokeStyle = color+"99"; ctx.lineWidth = 1.5/s.zoom; ctx.stroke();
      }
    }

    function loop(ts) {
      if (s.lastTs !== null) {
        const dt = (ts - s.lastTs) / 1000;
        const spd = SPEEDS[s.speedIdx];
        if (spd !== 0) {
          s.days += spd * dt;
          if (timelineRef.current)
            timelineRef.current.value = ((s.days % 36500) + 36500) % 36500;
        }
      }
      s.lastTs = ts;

      const { W, H, pxPerAu } = getDims();

      // Follow cam — target is in scene space, pan is also scene space
      // Screen center maps to scene point (-panX, -panY)
      // So to center a scene point (tx,ty): panX = -tx, panY = -ty
      if (s.following) {
        const pos = getBodyPos(s.following, s.days, pxPerAu);
        const targetPanX = -pos.x;
        const targetPanY = -pos.y;
        s.panX += (targetPanX - s.panX) * 0.1;
        s.panY += (targetPanY - s.panY) * 0.1;
      }

      const cx = W/2 + s.panX * s.zoom;
      const cy = H/2 + s.panY * s.zoom;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#030810"; ctx.fillRect(0, 0, W, H);

      s.stars.forEach(st => {
        ctx.beginPath(); ctx.arc(st.x*W, st.y*H, st.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(255,255,255,${st.a})`; ctx.fill();
      });

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(s.zoom, s.zoom);

      // Orbit rings
      PLANETS.forEach(planet => {
        ctx.beginPath(); ctx.arc(0, 0, planet.auDist * pxPerAu, 0, Math.PI*2);
        ctx.strokeStyle = "rgba(255,255,255,0.045)"; ctx.lineWidth = 0.5/s.zoom; ctx.stroke();
      });

      // Sun
      const sunRvis = Math.min(kmToPx(SUN_RADIUS_KM, pxPerAu), Math.min(W,H)*0.06/s.zoom);
      const sg = ctx.createRadialGradient(0,0,sunRvis*.3,0,0,sunRvis*3.5);
      sg.addColorStop(0,"rgba(255,220,80,0.3)"); sg.addColorStop(1,"transparent");
      ctx.beginPath(); ctx.arc(0,0,sunRvis*3.5,0,Math.PI*2); ctx.fillStyle=sg; ctx.fill();
      const sg2 = ctx.createRadialGradient(-sunRvis*.3,-sunRvis*.3,sunRvis*.05,0,0,sunRvis);
      sg2.addColorStop(0,"#fff7a0"); sg2.addColorStop(.4,"#ffd040"); sg2.addColorStop(1,"#ff6a00");
      ctx.beginPath(); ctx.arc(0,0,sunRvis,0,Math.PI*2); ctx.fillStyle=sg2; ctx.fill();
      if (s.following === 'sun') {
        ctx.beginPath(); ctx.arc(0,0,sunRvis*1.7,0,Math.PI*2);
        ctx.strokeStyle="rgba(255,200,50,0.35)"; ctx.lineWidth=1.5/s.zoom; ctx.stroke();
      }

      const fsize = Math.max(6, 11/s.zoom);
      ctx.font = `${fsize}px monospace`;

      // Planets + moons
      PLANETS.forEach(planet => {
        const pAngle = (s.days / planet.period) * Math.PI * 2;
        const px = Math.cos(pAngle) * planet.auDist * pxPerAu;
        const py = Math.sin(pAngle) * planet.auDist * pxPerAu;
        const pr = Math.max(kmToPx(planet.radiusKm, pxPerAu), 1.5/s.zoom);

        const isFollowedPlanet = s.following?.type === 'planet' && s.following?.name === planet.name;

        // Moon orbit rings (only draw if zoomed in enough to matter)
        const moons = MOONS[planet.name] || [];
        moons.forEach(moon => {
          const orbitPx = kmToPx(moon.orbitKm, pxPerAu);
          if (orbitPx * s.zoom > 2) {
            ctx.beginPath(); ctx.arc(px, py, orbitPx, 0, Math.PI*2);
            ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 0.5/s.zoom; ctx.stroke();
          }
        });

        drawBody(px, py, pr, planet.color, {
          continents: planet.hasAtmo,
          bands: planet.bands,
          rings: planet.rings,
          glow: planet.radiusKm > 30000,
          following: isFollowedPlanet,
        });

        // Planet label
        ctx.textAlign = "center";
        ctx.fillStyle = isFollowedPlanet ? planet.color+"ee" : "rgba(180,210,255,0.45)";
        ctx.fillText(planet.name, px, py - pr - fsize*0.3);

        // Moons
        moons.forEach(moon => {
          const mAngle = (s.days / moon.period) * Math.PI * 2;
          const orbitPx = kmToPx(moon.orbitKm, pxPerAu);
          const mx = px + Math.cos(mAngle) * orbitPx;
          const my = py + Math.sin(mAngle) * orbitPx;
          const mr = Math.max(kmToPx(moon.radiusKm, pxPerAu), 1.5/s.zoom);

          const isFollowedMoon = s.following?.type === 'moon' && s.following?.name === moon.name;

          // Only render moon if it's visible enough or being followed
          if (mr * s.zoom > 0.5 || isFollowedMoon) {
            drawBody(mx, my, mr, moon.color, { following: isFollowedMoon });
            if (mr * s.zoom > 3 || isFollowedMoon) {
              ctx.textAlign = "center";
              ctx.fillStyle = isFollowedMoon ? moon.color+"ee" : "rgba(160,180,200,0.35)";
              ctx.fillText(moon.name, mx, my - mr - fsize*0.3);
            }
          }
        });
      });

      // Sun label
      ctx.textAlign = "center";
      ctx.fillStyle = s.following === 'sun' ? "rgba(255,220,80,0.9)" : "rgba(255,220,80,0.4)";
      ctx.fillText("Sun", 0, sunRvis + fsize + 4);

      ctx.restore();

      // HUD
      const fsHud = Math.max(9, Math.round(W * 0.015));
      ctx.font = `${fsHud}px monospace`;
      ctx.fillStyle = "rgba(150,180,255,0.4)";
      const yr = s.days / 365.25;
      const yLabel = Math.abs(yr) < 0.1 ? "now" : yr < 0 ? `${Math.abs(yr).toFixed(1)}yr ago` : `+${yr.toFixed(1)}yr`;
      ctx.textAlign = "left";  ctx.fillText(yLabel, 12, 20);
      ctx.textAlign = "right"; ctx.fillText(`${s.zoom.toFixed(2)}×`, W-12, 20);
      if (s.following) {
        const label = s.following === 'sun' ? 'Sun'
          : s.following.type === 'moon' ? `${s.following.name} (${s.following.parentName})`
          : s.following.name;
        ctx.textAlign = "center"; ctx.fillStyle = "rgba(150,180,255,0.3)";
        ctx.fillText(`following ${label}`, W/2, 20);
      }

      s.rafId = requestAnimationFrame(loop);
    }

    s.rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(s.rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [getDims, handleClick, getBodyPos, kmToPx]);

  function setSpeed(idx) {
    state.current.speedIdx = Math.max(0, Math.min(SPEEDS.length - 1, idx));
    updateSpeedLabel();
  }

  const btnStyle = {
    background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(255,255,255,0.15)",
    color: "rgba(200,220,255,0.85)", borderRadius: 6, fontFamily: "monospace",
    fontSize: 12, padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap",
  };

  return (
    <div style={{ width:"100vw", height:"100vh", background:"#030810", overflow:"hidden", userSelect:"none", display:"flex", flexDirection:"column" }}>
      <canvas ref={canvasRef} style={{ display:"block", width:"100%", flex:1, cursor:"grab" }} />
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 16px 12px", borderTop:"0.5px solid rgba(255,255,255,0.07)", flexShrink:0 }}>
        <button style={btnStyle} onClick={() => setSpeed(0)}>◀◀</button>
        <button style={btnStyle} onClick={() => setSpeed(state.current.speedIdx - 1)}>◀</button>
        <button style={btnStyle} onClick={() => setSpeed(5)}>⏸</button>
        <button style={btnStyle} onClick={() => setSpeed(state.current.speedIdx + 1)}>▶</button>
        <button style={btnStyle} onClick={() => setSpeed(SPEEDS.length - 1)}>▶▶</button>
        <input
          ref={timelineRef} type="range" min="0" max="36500" defaultValue="0" step="1"
          style={{ flex:1, accentColor:"#4a7fc1" }}
          onChange={(e) => { state.current.days = parseFloat(e.target.value); }}
        />
        <span ref={speedLabelRef} style={{ fontFamily:"monospace", fontSize:11, color:"rgba(150,180,255,0.6)", minWidth:72, textAlign:"right" }}>
          +1d/s
        </span>
      </div>
    </div>
  );
}

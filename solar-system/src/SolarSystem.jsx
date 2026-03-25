import { useEffect, useRef, useCallback } from "react";

const SPEEDS = [-30, -7, -1, 0, 1, 7, 30];
const MOON_PERIOD = 27.32;

export default function SolarSystem() {
  const canvasRef = useRef(null);
  const timelineRef = useRef(null);
  const speedLabelRef = useRef(null);
  const followLabelRef = useRef(null);

  // Mutable state in refs to avoid re-render churn
  const state = useRef({
    speedIdx: 4,
    days: 0,
    zoom: 1,
    panX: 0,
    panY: 0,
    following: "free", // 'free' | 'earth' | 'moon'
    dragging: false,
    didDrag: false,
    dragStartX: 0,
    dragStartY: 0,
    panStartX: 0,
    panStartY: 0,
    lastTouchDist: null,
    lastTs: null,
    rafId: null,
    stars: Array.from({ length: 200 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1 + 0.3,
      a: Math.random() * 0.45 + 0.2,
    })),
  });

  const getDims = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return {};
    const W = canvas.width;
    const H = canvas.height;
    const earthR = Math.max(4, Math.min(W, H) / 140);
    const moonOrbit = earthR * 60.3;
    return { W, H, earthR, moonOrbit };
  }, []);

  const updateSpeedLabel = useCallback(() => {
    const s = SPEEDS[state.current.speedIdx];
    if (!speedLabelRef.current) return;
    speedLabelRef.current.textContent =
      s === 0 ? "paused" : `${s > 0 ? "+" : "−"}${Math.abs(s)}d/s`;
  }, []);

  const updateFollowLabel = useCallback(() => {
    if (!followLabelRef.current) return;
    const f = state.current.following;
    followLabelRef.current.textContent = f !== "free" ? `following ${f}` : "";
  }, []);

  const handleClick = useCallback(
    (clientX, clientY) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { W, H, earthR, moonOrbit } = getDims();
      const { zoom, panX, panY, days } = state.current;
      const rect = canvas.getBoundingClientRect();
      const px = (clientX - rect.left) * (canvas.width / rect.width);
      const py = (clientY - rect.top) * (canvas.height / rect.height);
      const cx = W / 2 + panX;
      const cy = H / 2 + panY;
      const sx = (px - cx) / zoom;
      const sy = (py - cy) / zoom;

      const moonR = earthR * (1737 / 6371);
      const moonAngle = (days / MOON_PERIOD) * Math.PI * 2;
      const moonX = Math.cos(moonAngle) * moonOrbit;
      const moonY = Math.sin(moonAngle) * moonOrbit;

      const dEarth = Math.sqrt(sx * sx + sy * sy);
      const dMoon = Math.sqrt((sx - moonX) ** 2 + (sy - moonY) ** 2);

      if (dEarth < Math.max(earthR * 2.5, 12 / zoom)) {
        state.current.following = "earth";
      } else if (dMoon < Math.max(moonR * 4, 12 / zoom)) {
        state.current.following = "moon";
      } else {
        state.current.following = "free";
      }
      updateFollowLabel();
    },
    [getDims, updateFollowLabel]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const s = state.current;

    // Resize
    const CONTROLS_H = 52;
    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight - CONTROLS_H;
    }
    resize();
    window.addEventListener("resize", resize);

    // Wheel
    function onWheel(e) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);
      const { W, H } = getDims();
      // Convert mouse to scene space before zoom changes
      const sceneX = (mx - W / 2 - s.panX) / s.zoom;
      const sceneY = (my - H / 2 - s.panY) / s.zoom;
      s.zoom = Math.min(80, Math.max(0.3, s.zoom * factor));
      // Recompute pan so the same scene point stays under the mouse
      s.panX = mx - W / 2 - sceneX * s.zoom;
      s.panY = my - H / 2 - sceneY * s.zoom;
    }
    canvas.addEventListener("wheel", onWheel, { passive: false });

    // Mouse
    function onMouseDown(e) {
      s.dragging = true;
      s.didDrag = false;
      s.dragStartX = e.clientX;
      s.dragStartY = e.clientY;
      s.panStartX = s.panX;
      s.panStartY = s.panY;
      canvas.style.cursor = "grabbing";
    }
    function onMouseMove(e) {
      if (!s.dragging) return;
      const dx = e.clientX - s.dragStartX;
      const dy = e.clientY - s.dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        s.didDrag = true;
        s.following = "free";
        updateFollowLabel();
      }
      const rect = canvas.getBoundingClientRect();
      const scale = canvas.width / rect.width;
      s.panX = s.panStartX + dx * scale;
      s.panY = s.panStartY + dy * scale;
    }
    function onMouseUp(e) {
      if (!s.didDrag) handleClick(e.clientX, e.clientY);
      s.dragging = false;
      canvas.style.cursor = "grab";
    }
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    // Touch
    function onTouchStart(e) {
      if (e.touches.length === 1) {
        s.dragging = true;
        s.didDrag = false;
        s.dragStartX = e.touches[0].clientX;
        s.dragStartY = e.touches[0].clientY;
        s.panStartX = s.panX;
        s.panStartY = s.panY;
      }
      if (e.touches.length === 2) {
        s.dragging = false;
        s.lastTouchDist = null;
      }
    }
    function onTouchMove(e) {
      e.preventDefault();
      if (e.touches.length === 1 && s.dragging) {
        const dx = e.touches[0].clientX - s.dragStartX;
        const dy = e.touches[0].clientY - s.dragStartY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          s.didDrag = true;
          s.following = "free";
          updateFollowLabel();
        }
        const rect = canvas.getBoundingClientRect();
        const scale = canvas.width / rect.width;
        s.panX = s.panStartX + dx * scale;
        s.panY = s.panStartY + dy * scale;
      }
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (s.lastTouchDist !== null)
          s.zoom = Math.min(80, Math.max(0.3, s.zoom * (dist / s.lastTouchDist)));
        s.lastTouchDist = dist;
      }
    }
    function onTouchEnd(e) {
      if (!s.didDrag && e.changedTouches.length === 1)
        handleClick(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      s.dragging = false;
      s.lastTouchDist = null;
    }
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    // Animation loop
    function loop(ts) {
      if (s.lastTs !== null) {
        const dt = (ts - s.lastTs) / 1000;
        const spd = SPEEDS[s.speedIdx];
        if (spd !== 0) {
          s.days = Math.max(-3650, Math.min(3650, s.days + spd * dt));
          if (timelineRef.current) timelineRef.current.value = s.days;
        }
      }
      s.lastTs = ts;

      const { W, H, earthR, moonOrbit } = getDims();
      const moonR = earthR * (1737 / 6371);
      const moonAngle = (s.days / MOON_PERIOD) * Math.PI * 2;
      const moonX = Math.cos(moonAngle) * moonOrbit;
      const moonY = Math.sin(moonAngle) * moonOrbit;

      // Follow cam
      if (s.following === "earth") {
        s.panX += (0 - s.panX) * 0.12;
        s.panY += (0 - s.panY) * 0.12;
      } else if (s.following === "moon") {
        const tx = -moonX * s.zoom;
        const ty = -moonY * s.zoom;
        s.panX += (tx - s.panX) * 0.12;
        s.panY += (ty - s.panY) * 0.12;
      }

      const cx = W / 2 + s.panX;
      const cy = H / 2 + s.panY;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#030810";
      ctx.fillRect(0, 0, W, H);

      // Stars
      s.stars.forEach((star) => {
        ctx.beginPath();
        ctx.arc(star.x * W, star.y * H, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${star.a})`;
        ctx.fill();
      });

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(s.zoom, s.zoom);

      // Orbit ring
      ctx.beginPath();
      ctx.arc(0, 0, moonOrbit, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 0.5 / s.zoom;
      ctx.stroke();

      // Earth
      const eg = ctx.createRadialGradient(-earthR * 0.3, -earthR * 0.3, earthR * 0.05, 0, 0, earthR);
      eg.addColorStop(0, "#7ec8ff");
      eg.addColorStop(0.4, "#2a6dd9");
      eg.addColorStop(0.8, "#1a4fa0");
      eg.addColorStop(1, "#0d2a5e");
      ctx.beginPath();
      ctx.arc(0, 0, earthR, 0, Math.PI * 2);
      ctx.fillStyle = eg;
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, earthR, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "rgba(55,150,60,0.6)";
      ctx.beginPath();
      ctx.ellipse(-earthR * 0.1, -earthR * 0.2, earthR * 0.38, earthR * 0.27, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(earthR * 0.3, earthR * 0.1, earthR * 0.22, earthR * 0.32, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const atm = ctx.createRadialGradient(0, 0, earthR * 0.9, 0, 0, earthR * 1.15);
      atm.addColorStop(0, "rgba(100,180,255,0.2)");
      atm.addColorStop(1, "rgba(100,180,255,0)");
      ctx.beginPath();
      ctx.arc(0, 0, earthR * 1.15, 0, Math.PI * 2);
      ctx.fillStyle = atm;
      ctx.fill();

      if (s.following === "earth") {
        ctx.beginPath();
        ctx.arc(0, 0, earthR * 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(100,180,255,0.35)";
        ctx.lineWidth = 1 / s.zoom;
        ctx.stroke();
      }

      // Moon
      const mg = ctx.createRadialGradient(moonX - moonR * 0.3, moonY - moonR * 0.3, moonR * 0.05, moonX, moonY, moonR);
      mg.addColorStop(0, "#e2dece");
      mg.addColorStop(0.5, "#b8b4a2");
      mg.addColorStop(1, "#6e6c5e");
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
      ctx.fillStyle = mg;
      ctx.fill();

      if (moonR * s.zoom > 3) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = "rgba(70,68,56,0.45)";
        ctx.beginPath();
        ctx.arc(moonX + moonR * 0.22, moonY - moonR * 0.18, moonR * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(moonX - moonR * 0.28, moonY + moonR * 0.22, moonR * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (s.following === "moon") {
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonR * 2.2, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(220,210,180,0.4)";
        ctx.lineWidth = 1 / s.zoom;
        ctx.stroke();
      }

      // Labels
      const fsize = Math.max(9, Math.round(W * 0.022)) / s.zoom;
      ctx.font = `${fsize}px monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = s.following === "earth" ? "rgba(100,180,255,0.85)" : "rgba(180,210,255,0.5)";
      ctx.fillText("Earth", 0, earthR + fsize + 2);
      ctx.fillStyle = s.following === "moon" ? "rgba(220,210,180,0.9)" : "rgba(180,210,255,0.5)";
      ctx.fillText("Moon", moonX, moonY - moonR - 4);

      ctx.restore();

      // HUD
      const dAbs = Math.abs(Math.round(s.days));
      const dLabel = s.days < -0.5 ? `${dAbs}d ago` : s.days > 0.5 ? `+${dAbs}d` : "now";
      const fsHud = Math.max(9, Math.round(W * 0.02));
      ctx.font = `${fsHud}px monospace`;
      ctx.fillStyle = "rgba(150,180,255,0.4)";
      ctx.textAlign = "left";
      ctx.fillText(dLabel, 12, 18);
      ctx.textAlign = "right";
      ctx.fillText(`${s.zoom.toFixed(1)}×`, W - 12, 18);
      if (s.following !== "free") {
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(150,180,255,0.35)";
        ctx.fillText(`following ${s.following}`, W / 2, 18);
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
  }, [getDims, handleClick, updateFollowLabel]);

  function setSpeed(idx) {
    state.current.speedIdx = idx;
    updateSpeedLabel();
  }

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#030810", overflow: "hidden", userSelect: "none", display: "flex", flexDirection: "column" }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", flex: 1, cursor: "grab" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px 14px", borderTop: "0.5px solid rgba(255,255,255,0.07)" }}>
        {[
          { label: "◀◀", idx: 0 },
          { label: "◀",  idx: Math.max(0, state.current.speedIdx - 1), action: () => setSpeed(Math.max(0, state.current.speedIdx - 1)) },
          { label: "⏸",  idx: 3 },
          { label: "▶",  idx: Math.min(SPEEDS.length - 1, state.current.speedIdx + 1), action: () => setSpeed(Math.min(SPEEDS.length - 1, state.current.speedIdx + 1)) },
          { label: "▶▶", idx: 6 },
        ].map(({ label, idx, action }) => (
          <button
            key={label}
            onClick={action ?? (() => setSpeed(idx))}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "0.5px solid rgba(255,255,255,0.15)",
              color: "rgba(200,220,255,0.85)",
              borderRadius: 6,
              fontFamily: "monospace",
              fontSize: 12,
              padding: "4px 10px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </button>
        ))}

        <input
          ref={timelineRef}
          type="range"
          min="-3650"
          max="3650"
          defaultValue="0"
          step="1"
          style={{ flex: 1, accentColor: "#4a7fc1" }}
          onChange={(e) => { state.current.days = parseFloat(e.target.value); }}
        />

        <span ref={speedLabelRef} style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(150,180,255,0.6)", minWidth: 80, textAlign: "right" }}>
          +1d/s
        </span>
      </div>
    </div>
  );
}

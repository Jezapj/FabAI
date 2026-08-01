import React, { useEffect, useState, useRef } from "react";
import { GoogleLogin, googleLogout } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { apiPath, parseApiJson, probeApi, API_BASE } from './config';

// ── Types ────────────────────────────────────────────────────────────────────
interface OutfitItem { id: number; label: string; value: number; category: string; color?: string; }
interface Outfit     { [key: string]: OutfitItem | null; }
interface WeatherDay { date: string; maxTemp: number; minTemp: number; weatherCode: number; }
interface InvItem    { id: number; label: string; value: number; category: string; color?: string; }
interface DayPrefs   { formality: 'casual' | 'formal'; colorPreset: string; }

type Formality = DayPrefs['formality'];

// ── WMO weather-code table ───────────────────────────────────────────────────
const WMO: Record<number, [string, string]> = {
  0:  ['☀️',  'Clear sky'],       1:  ['🌤️', 'Mainly clear'],
  2:  ['⛅',  'Partly cloudy'],   3:  ['☁️',  'Overcast'],
  45: ['🌫️', 'Fog'],             48: ['🌫️', 'Icy fog'],
  51: ['🌦️', 'Light drizzle'],   53: ['🌦️', 'Drizzle'],
  55: ['🌧️', 'Heavy drizzle'],   61: ['🌧️', 'Light rain'],
  63: ['🌧️', 'Rain'],            65: ['🌧️', 'Heavy rain'],
  71: ['🌨️', 'Light snow'],      73: ['❄️',  'Snow'],
  75: ['❄️',  'Heavy snow'],     77: ['🌨️', 'Snow grains'],
  80: ['🌦️', 'Showers'],        81: ['🌧️', 'Rain showers'],
  82: ['⛈️', 'Heavy showers'],   95: ['⛈️', 'Thunderstorm'],
  96: ['⛈️', 'Storm + hail'],    99: ['⛈️', 'Storm + hail'],
};
const wmo = (code: number): [string, string] => WMO[code] ?? ['🌡️', 'Unknown'];

const RAIN_CODES = new Set([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99]);

const COLOR_PRESETS: { id: string; label: string }[] = [
  { id: 'any',          label: 'Any colours' },
  { id: 'accent_black', label: 'Single accent + black' },
  { id: 'earth_sky',    label: 'Light brown + light blue' },
  { id: 'neutrals',     label: 'Neutrals only' },
];

function isRainy(code: number): boolean {
  return RAIN_CODES.has(code);
}

function defaultDayPrefs(): DayPrefs {
  return { formality: 'casual', colorPreset: 'any' };
}

function dayLabel(dateStr: string, i: number): string {
  if (i === 0) return 'Today';
  if (i === 1) return 'Tmrw';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short' });
}

const OUTFIT_ORDER = ['hat', 'top', 'bot', 'shoe'] as const;
const OUTFIT_PART_LABEL: Record<(typeof OUTFIT_ORDER)[number], string> = {
  hat: 'Hat',
  top: 'Top',
  bot: 'Bottom',
  shoe: 'Shoes',
};

type SwipeView = 0 | 1 | 2; // Wardrobe | Landing | Add

const SWIPE_THRESHOLD_PX = 56;
const VIEW_LABELS = ['Wardrobe', 'Home', 'Add'] as const;

// ── Loading overlay (section-scoped) ─────────────────────────────────────────
interface LoadingOverlayProps {
  loading: boolean;
  message?: string;
  className?: string;
  children: React.ReactNode;
}

function LoadingOverlay({ loading, message = 'Loading...', className, children }: LoadingOverlayProps) {
  return (
    <div className={`loading-overlay-host${className ? ` ${className}` : ''}`}>
      {children}
      {loading && (
        <div className="loading-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="loading-overlay__spinner" aria-hidden="true" />
          <p className="loading-overlay__text">{message}</p>
        </div>
      )}
    </div>
  );
}

// ── Temperature → warmth target conversion ───────────────────────────────────
// Maps °C to 0-100 where 0 = very hot (light clothes), 100 = very cold (heavy)
// Calibrated for range -10 °C (100) → 45 °C (0)
// Uses a sigmoid to make differences around 15-25°C more pronounced
function tempToTarget(maxTemp: number): number {
  const x = maxTemp;
  const sigmoid = 1 / (1 + Math.exp(0.15 * (x - 18)));
  return Math.round(sigmoid * 100);
}



// ── Weather Widget ────────────────────────────────────────────────────────────
interface WeatherWidgetProps {
  onDaySelect?: (day: WeatherDay, label: string) => void;
  formality: Formality;
  colorPreset: string;
  onFormalityChange: (value: Formality) => void;
  onColorPresetChange: (value: string) => void;
}

function WeatherWidget({
  onDaySelect,
  formality,
  colorPreset,
  onFormalityChange,
  onColorPresetChange,
}: WeatherWidgetProps) {
  const [forecast, setForecast] = useState<WeatherDay[]>([]);
  const [city, setCity]         = useState('');
  const [status, setStatus]     = useState<'loading' | 'ok' | 'error'>('loading');
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    async function load(lat: number, lon: number) {
      try {
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=7`
        );
        const d = await r.json();
        const days: WeatherDay[] = d.daily.time.map((date: string, i: number) => ({
          date,
          maxTemp: Math.round(d.daily.temperature_2m_max[i]),
          minTemp: Math.round(d.daily.temperature_2m_min[i]),
          weatherCode: d.daily.weathercode[i],
        }));
        setForecast(days);
        if (onDaySelect && days.length > 0) {
          onDaySelect(days[0], 'Today');
        }
        setStatus('ok');
      } catch {
        setStatus('error');
      }
    }

    if (!navigator.geolocation) {
      load(-37.8136, 144.9631);
      setCity('Melbourne');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        load(pos.coords.latitude, pos.coords.longitude);
        try {
          const g  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`
          );
          const gd = await g.json();
          setCity(gd.address?.city ?? gd.address?.town ?? gd.address?.suburb ?? 'Your Location');
        } catch { setCity('Your Location'); }
      },
      () => { load(-37.8136, 144.9631); setCity('Melbourne'); },
      { timeout: 5000 }
    );
  }, []);

  const wrap: React.CSSProperties = {
    background: 'rgba(0,0,0,0.72)',
    borderRadius: 14,
    padding: '8px 14px',
    margin: 0,
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'white',
    width: '100%',
    boxSizing: 'border-box',
    flexShrink: 0,
  };

  if (status === 'loading') return (
    <div className="weather-widget" style={wrap}>
      <p style={{ textAlign: 'center', color: '#aaa', margin: 0, fontSize: 13 }}>Loading forecast…</p>
    </div>
  );
  if (status === 'error') return (
    <div className="weather-widget" style={wrap}>
      <p style={{ textAlign: 'center', color: '#666', margin: 0, fontSize: 13 }}>Weather unavailable</p>
    </div>
  );

  return (
    <div className="weather-widget" style={wrap}>
      <p style={{ margin: '0 0 8px', fontSize: 12, color: '#bbb', fontWeight: 500 }}>
        📍 {city} · Weekly Forecast
      </p>
      <div className="weather-strip">
        {forecast.map((day, i) => {
          const [emoji, label] = wmo(day.weatherCode);
          const today    = i === 0;
          const selected = i === selectedIdx;
          const classes  = [
            'weather-day',
            today    ? 'weather-day--today'    : '',
            selected ? 'weather-day--selected' : '',
          ].filter(Boolean).join(' ');
          return (
            <div
              key={day.date}
              className={classes}
              onClick={() => {
                setSelectedIdx(i);
                if (onDaySelect) onDaySelect(day, dayLabel(day.date, i));
              }}
              title={`Select ${dayLabel(day.date, i)}, ${day.maxTemp}°C${isRainy(day.weatherCode) ? ' · rainy' : ''}`}
            >
              <div className="weather-day__name">{dayLabel(day.date, i)}</div>
              <div className="weather-day__icon">{emoji}</div>
              <div className="weather-day__desc">{label}</div>
              <div className="weather-day__max">{day.maxTemp}°</div>
              <div className="weather-day__min">{day.minTemp}°</div>
            </div>
          );
        })}
      </div>
      {forecast.length > 0 && (
        <>
          <div className="day-prefs" onPointerDown={e => e.stopPropagation()}>
            <div className="day-prefs__group">
              <span className="day-prefs__label">Style</span>
              <div className="day-prefs__toggle">
                <button
                  type="button"
                  className={`day-prefs__btn${formality === 'casual' ? ' day-prefs__btn--active' : ''}`}
                  onClick={() => onFormalityChange('casual')}
                >
                  Casual
                </button>
                <button
                  type="button"
                  className={`day-prefs__btn${formality === 'formal' ? ' day-prefs__btn--active' : ''}`}
                  onClick={() => onFormalityChange('formal')}
                >
                  Formal
                </button>
              </div>
            </div>
            <div className="day-prefs__group">
              <label className="day-prefs__label" htmlFor="color-preset">Colour palette</label>
              <select
                id="color-preset"
                className="day-prefs__select"
                value={colorPreset}
                onChange={e => onColorPresetChange(e.target.value)}
              >
                {COLOR_PRESETS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="weather-day--target-label">
            🧥 Suggestions for <strong style={{ color: '#e2e8f0' }}>{dayLabel(forecast[selectedIdx].date, selectedIdx)}</strong>
            {' · '}{forecast[selectedIdx].maxTemp}°C
            {' · '}warmth {tempToTarget(forecast[selectedIdx].maxTemp)}/100
            {isRainy(forecast[selectedIdx].weatherCode) && ' · 🌧️ rain-aware'}
            {formality === 'formal' && ' · 👔 formal'}
            {colorPreset !== 'any' && ` · ${COLOR_PRESETS.find(p => p.id === colorPreset)?.label.toLowerCase()}`}
          </p>
        </>
      )}
    </div>
  );
}

// ── Inventory Modal ───────────────────────────────────────────────────────────
const CATS = ['All', 'Top', 'Bottom', 'Shoes', 'Optional', 'Head', 'One piece'];
const CAT_COLORS: Record<string, string> = {
  'Top':       'rgba(80,150,255,.25)',
  'Bottom':    'rgba(80,200,120,.25)',
  'Shoes':     'rgba(255,180,60,.25)',
  'Optional':  'rgba(180,100,255,.25)',
  'Head':      'rgba(255,120,120,.25)',
  'One piece': 'rgba(255,160,80,.25)',
};

interface InvContentProps { user: any; refreshKey: number; }

function InventoryContent({ user, refreshKey }: InvContentProps) {
  const [items,   setItems]   = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('All');

  useEffect(() => {
    if (!user?.sub) { setLoading(false); return; }
    setLoading(true);
    fetch(apiPath(`/api/inventory?user_id=${user.sub}`))
      .then(r => parseApiJson(r))
      .then(d  => { setItems(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user, refreshKey]);

  const shown = filter === 'All' ? items : items.filter(x => x.category === filter);

  return (
    <div className="wardrobe-view">
      <div className="wardrobe-view__header">
        <h2>My Wardrobe{!loading ? ` · ${items.length}` : ''}</h2>
      </div>

      <div className="wardrobe-view__filters" onPointerDown={e => e.stopPropagation()}>
        {CATS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={`inv-filter${filter === c ? ' inv-filter--active' : ''}`}
          >
            {c}
          </button>
        ))}
      </div>

      <LoadingOverlay loading={loading} message="Loading..." className="wardrobe-view__body">
        {loading ? (
          <div className="wardrobe-view__empty" aria-hidden="true" />
        ) : shown.length === 0 ? (
          <p className="wardrobe-view__empty">
            {items.length === 0
              ? 'No items yet. Swipe left to add your first piece!'
              : `No ${filter} items in your wardrobe.`}
          </p>
        ) : (
          <div className="inv-grid">
            {shown.map(item => (
              <div key={item.id} className="inv-item">
                <div className="inv-item__img-wrap">
                  <img
                    src={apiPath(`/api/image/${item.id}`)}
                    alt={item.label}
                    className="inv-item__img"
                  />
                </div>
                <div className="inv-item__info">
                  <input
                    className="inv-item__label-input"
                    value={item.label}
                    onChange={(e) => {
                      const newLabel = e.target.value;
                      setItems(prev => prev.map(i => i.id === item.id ? { ...i, label: newLabel } : i));
                    }}
                    onBlur={(e) => {
                      fetch(apiPath(`/api/inventory/${item.id}`), {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ label: e.target.value })
                      });
                    }}
                  />
                  <div className="inv-item__meta">
                    <select
                      className="inv-item__cat-select"
                      value={item.category}
                      onChange={(e) => {
                        const newCat = e.target.value;
                        fetch(apiPath(`/api/inventory/${item.id}`), {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ category: newCat })
                        })
                          .then(r => r.json())
                          .then(updated => {
                            setItems(prev => prev.map(i => i.id === item.id ? { ...i, category: updated.category, value: updated.value } : i));
                          });
                      }}
                      style={{ background: CAT_COLORS[item.category] ?? 'rgba(255,255,255,.1)' }}
                    >
                      {CATS.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button
                      type="button"
                      className="inv-item__delete"
                      onClick={() => {
                        if (window.confirm('Delete this item?')) {
                          fetch(apiPath(`/api/inventory/${item.id}`), { method: 'DELETE' })
                            .then(() => setItems(prev => prev.filter(i => i.id !== item.id)));
                        }
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </LoadingOverlay>
    </div>
  );
}

// ── Outfit carousel (gesture-isolated from page swipe) ───────────────────────
interface OutfitCarouselProps {
  outfits: Outfit[];
  selectedDay: string;
  formality: Formality;
  loading: boolean;
}

function OutfitCarousel({ outfits, selectedDay, formality, loading }: OutfitCarouselProps) {
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const locked = useRef<'h' | 'v' | null>(null);
  const pointerId = useRef<number | null>(null);

  useEffect(() => {
    setIndex(0);
    setDragX(0);
  }, [outfits]);

  useEffect(() => {
    if (index >= outfits.length && outfits.length > 0) {
      setIndex(outfits.length - 1);
    }
  }, [index, outfits.length]);

  const commitSwipe = (dx: number) => {
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) {
      setDragX(0);
      return;
    }
    if (dx < 0 && index < outfits.length - 1) setIndex(i => i + 1);
    else if (dx > 0 && index > 0) setIndex(i => i - 1);
    setDragX(0);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    pointerId.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    startY.current = e.clientY;
    locked.current = null;
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (pointerId.current !== e.pointerId || !dragging) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (!locked.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      locked.current = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
    }
    if (locked.current === 'v') return;
    e.preventDefault();
    const atStart = index === 0 && dx > 0;
    const atEnd = index >= outfits.length - 1 && dx < 0;
    setDragX(atStart || atEnd ? dx * 0.25 : dx);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    setDragging(false);
    if (locked.current === 'h') commitSwipe(e.clientX - startX.current);
    else setDragX(0);
    locked.current = null;
  };

  const orderedItems = (outfit: Outfit) =>
    OUTFIT_ORDER
      .map(part => ({ part, item: outfit[part] ?? null }))
      .filter((row): row is { part: (typeof OUTFIT_ORDER)[number]; item: OutfitItem } => row.item != null);

  return (
    <LoadingOverlay loading={loading} message="Thinking..." className="outfit-carousel-wrap">
      <div className="outfit-carousel-header">
        <h3>
          Outfits for {selectedDay}
          {formality === 'formal' ? ' · Formal' : ''}
        </h3>
        {outfits.length > 0 && (
          <span className="outfit-carousel-count">{index + 1} / {outfits.length}</span>
        )}
      </div>

      {!loading && outfits.length === 0 ? (
        <div className="no-outfits">
          <p>Not enough items to suggest an outfit for this weather.</p>
          <p className="no-outfits__hint">Add more Tops, Bottoms, and Shoes — swipe left to upload.</p>
        </div>
      ) : (
        <div
          className="outfit-carousel"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            className={`outfit-carousel__track${dragging ? ' outfit-carousel__track--dragging' : ''}`}
            style={{
              transform: `translateX(calc(-${index * 100}% + ${dragX}px))`,
            }}
          >
            {outfits.map((outfit, idx) => {
              const rows = orderedItems(outfit);
              return (
                <div key={idx} className="outfit-carousel__slide">
                  <div className={`outfit-stack outfit-stack--${rows.length}`}>
                    {rows.map(({ part, item }) => (
                      <div key={part} className="outfit-stack__row">
                        <img src={apiPath(`/api/image/${item.id}`)} alt={item.label} />
                        <div className="outfit-stack__meta">
                          <span className="outfit-stack__part">{OUTFIT_PART_LABEL[part]}</span>
                          <span className="outfit-stack__label">
                            {item.label}
                            {item.color ? ` · ${item.color}` : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </LoadingOverlay>
  );
}

// ── Welcome toast on login ────────────────────────────────────────────────────
function WelcomeToast({ name, onDone }: { name: string; onDone: () => void }) {
  const [fading, setFading] = React.useState(false);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setFading(true), 1500);
    const hideTimer = window.setTimeout(onDone, 2000);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [onDone]);

  return (
    <div className={`welcome-toast${fading ? ' welcome-toast--fading' : ''}`} role="status" aria-live="polite">
      <div className="welcome-toast__content">
        <h2>Welcome, {name}</h2>
        <p>Your personal wardrobe assistant</p>
      </div>
    </div>
  );
}

// ── Login / Dashboard ─────────────────────────────────────────────────────────
export function Login({ user, setUser }: { user: any, setUser: any }) {
  const [classid,    setClassid]    = React.useState<any>('');
  const [prediction, setPrediction] = React.useState('');
  const [outfits,    setOutfits]    = React.useState<Outfit[]>([]);
  const [outfitsLoading, setOutfitsLoading] = React.useState(false);
  const [imageUrl,   setImageUrl]   = React.useState('');
  const [outfitTarget, setOutfitTarget] = React.useState(50);
  const [selectedDay,  setSelectedDay]  = React.useState('Today');
  const [selectedDate, setSelectedDate] = React.useState('');
  const [weatherCode,  setWeatherCode]  = React.useState(0);
  const [formality,    setFormality]    = React.useState<Formality>('casual');
  const [colorPreset,  setColorPreset]  = React.useState('any');
  const [dayPrefs,     setDayPrefs]     = React.useState<Record<string, DayPrefs>>({});
  const [outfitRefresh, setOutfitRefresh] = React.useState(0);
  const [inventoryRefresh, setInventoryRefresh] = React.useState(0);
  const [showWelcome, setShowWelcome] = React.useState(false);
  const [backendStatus, setBackendStatus] = React.useState<'starting' | 'ready' | 'error'>('starting');
  const [busy, setBusy] = React.useState(false);
  const [authError, setAuthError] = React.useState('');
  const [viewIndex, setViewIndex] = React.useState<SwipeView>(1);
  const [pageDragX, setPageDragX] = React.useState(0);
  const [pageDragging, setPageDragging] = React.useState(false);

  const outfitRequestRef = useRef(0);
  const wakeAbortRef = useRef<AbortController | null>(null);
  const pageStartX = useRef(0);
  const pageStartY = useRef(0);
  const pageLocked = useRef<'h' | 'v' | null>(null);
  const pagePointerId = useRef<number | null>(null);
  const shellWidthRef = useRef(1);

  const wakeBackend = React.useCallback(async () => {
    if (import.meta.env.PROD && !API_BASE) {
      setBackendStatus('error');
      return false;
    }

    wakeAbortRef.current?.abort();
    const ac = new AbortController();
    wakeAbortRef.current = ac;
    setBackendStatus('starting');

    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      if (ac.signal.aborted) return false;
      try {
        if (await probeApi(ac.signal)) {
          setBackendStatus('ready');
          return true;
        }
      } catch {
        /* still waking */
      }
      await new Promise(res => setTimeout(res, 2000));
    }
    setBackendStatus('error');
    return false;
  }, []);

  useEffect(() => { setClassid(user ? 'b2' : '') }, [user]);

  useEffect(() => {
    if (!user) {
      setShowWelcome(false);
      setBackendStatus('starting');
      setViewIndex(1);
      wakeAbortRef.current?.abort();
      return;
    }
    setViewIndex(1);
    setInventoryRefresh(r => r + 1);
    wakeBackend();
    return () => wakeAbortRef.current?.abort();
  }, [user, wakeBackend]);

  useEffect(() => {
    if (!user?.sub || backendStatus !== 'ready') {
      setOutfitsLoading(false);
      return;
    }

    const requestId = ++outfitRequestRef.current;
    setOutfitsLoading(true);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        user_id: user.sub,
        target: String(outfitTarget),
        weather_code: String(weatherCode),
        formality,
        color_preset: colorPreset,
      });

      fetch(apiPath(`/api/outfit?${params}`))
        .then(r => {
          if (!r.ok) throw new Error(`Outfit request failed (${r.status})`);
          return parseApiJson(r);
        })
        .then(d => {
          if (requestId === outfitRequestRef.current) {
            setOutfits(Array.isArray(d) ? d : []);
            setOutfitsLoading(false);
          }
        })
        .catch(err => {
          console.error(err);
          if (requestId === outfitRequestRef.current) {
            setOutfits([]);
            setOutfitsLoading(false);
          }
        });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [user, outfitTarget, weatherCode, formality, colorPreset, outfitRefresh, backendStatus]);

  const updateDayPrefs = (date: string, patch: Partial<DayPrefs>) => {
    setDayPrefs(prev => ({
      ...prev,
      [date]: { ...(prev[date] ?? defaultDayPrefs()), ...patch },
    }));
  };

  const handleDaySelect = (day: WeatherDay, label: string) => {
    const prefs = dayPrefs[day.date] ?? defaultDayPrefs();
    setOutfitTarget(tempToTarget(day.maxTemp));
    setSelectedDay(label);
    setSelectedDate(day.date);
    setWeatherCode(day.weatherCode);
    setFormality(prefs.formality);
    setColorPreset(prefs.colorPreset);
  };

  const handleFormalityChange = (value: Formality) => {
    setFormality(value);
    if (selectedDate) updateDayPrefs(selectedDate, { formality: value });
  };

  const handleColorPresetChange = (value: string) => {
    setColorPreset(value);
    if (selectedDate) updateDayPrefs(selectedDate, { colorPreset: value });
  };

  const runClassification = async (id: number) => {
    setPrediction('Classifying…');
    try {
      // Same-origin /api → static rewrite (avoids cross-origin CORS when the API returns 502).
      const r = await fetch(apiPath(`/api/classify_image/${id}`), {
        method: 'POST',
      });
      const d = await parseApiJson(r);
      const body = d as Record<string, unknown>;
      if (!r.ok) {
        if (r.status === 502 || r.status === 503) {
          setBackendStatus('starting');
          wakeBackend();
        }
        throw new Error(
          typeof body.error === 'string' ? body.error : `Classification failed (${r.status})`
        );
      }
      setPrediction(String(body.prediction ?? body.label ?? ''));
      setOutfitRefresh(x => x + 1);
      setInventoryRefresh(x => x + 1);
    } catch (err) {
      console.error(err);
      setPrediction(err instanceof Error ? err.message : 'Classification failed');
      setBackendStatus('starting');
      wakeBackend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (backendStatus !== 'ready' || busy) return;

    setBusy(true);
    setPrediction('Uploading...');

    const formData = new FormData();
    formData.append('image', file);
    formData.append('user_info', JSON.stringify(user));

    fetch(apiPath('/api/uploadnx'), { method: 'POST', body: formData })
      .then(async (r) => {
        const d = await parseApiJson(r);
        if (!r.ok) {
          if (r.status === 502 || r.status === 503) {
            setBackendStatus('starting');
            wakeBackend();
          }
          const errBody = d as Record<string, unknown>;
          throw new Error(
            typeof errBody.error === 'string' ? errBody.error : `Upload failed (${r.status})`
          );
        }
        const body = d as Record<string, unknown>;
        const uploadedId =
          typeof body.image_id === 'number' ? body.image_id : Number(body.image_id);
        if (!uploadedId || Number.isNaN(uploadedId)) {
          throw new Error('Upload succeeded but no image_id returned');
        }
        setImageUrl(apiPath(`/api/image/${uploadedId}`));
        setPrediction('Saved to wardrobe. Starting AI…');
        setOutfitRefresh(x => x + 1);
        setInventoryRefresh(x => x + 1);
        await runClassification(uploadedId);
      })
      .catch((err) => {
        console.error(err);
        setPrediction(err instanceof Error ? err.message : 'Upload failed');
      })
      .finally(() => setBusy(false));
  };

  const canUpload = backendStatus === 'ready' && !busy;
  const statusLabel =
    backendStatus === 'ready'
      ? (busy ? 'Working…' : `Backend ready${API_BASE ? '' : ' (API URL missing!)'}`)
      : backendStatus === 'error'
        ? (import.meta.env.PROD && !API_BASE
            ? 'Set VITE_API_URL on web service & redeploy'
            : 'Backend offline — tap retry')
        : 'Starting backend…';

  const commitPageSwipe = (dx: number) => {
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) {
      setPageDragX(0);
      return;
    }
    if (dx < 0 && viewIndex < 2) setViewIndex(v => (v + 1) as SwipeView);
    else if (dx > 0 && viewIndex > 0) setViewIndex(v => (v - 1) as SwipeView);
    setPageDragX(0);
  };

  const onPagePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pagePointerId.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pageStartX.current = e.clientX;
    pageStartY.current = e.clientY;
    pageLocked.current = null;
    shellWidthRef.current = (e.currentTarget as HTMLElement).clientWidth || 1;
    setPageDragging(true);
  };

  const onPagePointerMove = (e: React.PointerEvent) => {
    if (pagePointerId.current !== e.pointerId || !pageDragging) return;
    const dx = e.clientX - pageStartX.current;
    const dy = e.clientY - pageStartY.current;
    if (!pageLocked.current) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      pageLocked.current = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
    }
    if (pageLocked.current === 'v') return;
    e.preventDefault();
    const atLeft = viewIndex === 0 && dx > 0;
    const atRight = viewIndex === 2 && dx < 0;
    setPageDragX(atLeft || atRight ? dx * 0.2 : dx);
  };

  const onPagePointerUp = (e: React.PointerEvent) => {
    if (pagePointerId.current !== e.pointerId) return;
    pagePointerId.current = null;
    setPageDragging(false);
    if (pageLocked.current === 'h') commitPageSwipe(e.clientX - pageStartX.current);
    else setPageDragX(0);
    pageLocked.current = null;
  };

  const logout = () => {
    googleLogout();
    setUser(null);
    setClassid('');
  };

  const trackPct = -viewIndex * 100;
  const dragPct = (pageDragX / shellWidthRef.current) * 100;

  return (
    <div className={classid}>
      {user ? (
        <>
          {showWelcome && (
            <WelcomeToast name={user.name} onDone={() => setShowWelcome(false)} />
          )}

          <div
            className="swipe-shell"
            onPointerDown={onPagePointerDown}
            onPointerMove={onPagePointerMove}
            onPointerUp={onPagePointerUp}
            onPointerCancel={onPagePointerUp}
          >
            <div
              className={`swipe-track${pageDragging ? ' swipe-track--dragging' : ''}`}
              style={{ transform: `translateX(calc(${trackPct}% + ${dragPct}%))` }}
            >
              {/* ── Left: Wardrobe ── */}
              <section className="swipe-pane swipe-pane--wardrobe" aria-label="Wardrobe">
                <InventoryContent user={user} refreshKey={inventoryRefresh} />
              </section>

              {/* ── Middle: Landing ── */}
              <section className="swipe-pane swipe-pane--landing" aria-label="Home">
                <WeatherWidget
                  onDaySelect={handleDaySelect}
                  formality={formality}
                  colorPreset={colorPreset}
                  onFormalityChange={handleFormalityChange}
                  onColorPresetChange={handleColorPresetChange}
                />
                <OutfitCarousel
                  outfits={outfits}
                  selectedDay={selectedDay}
                  formality={formality}
                  loading={outfitsLoading}
                />
              </section>

              {/* ── Right: Add / AI Classification ── */}
              <section className="swipe-pane swipe-pane--add" aria-label="Add items">
                <div className="add-view">
                  <div className="add-view__header">
                    <h2>Add item</h2>
                    <p className={`backend-status backend-status--${backendStatus}`}>
                      {statusLabel}
                      {backendStatus === 'error' && (
                        <>
                          {' '}
                          <button type="button" className="backend-status__retry" onClick={() => wakeBackend()}>
                            Retry
                          </button>
                        </>
                      )}
                    </p>
                  </div>

                  <LoadingOverlay loading={busy} message="Thinking..." className="add-view__stage">
                    {imageUrl ? (
                      <div className="add-view__result">
                        <img src={imageUrl} alt="Uploaded clothing" className="add-view__img" />
                        <p className="add-view__prediction">
                          AI Classifier: <strong>{prediction || 'Processing...'}</strong>
                        </p>
                      </div>
                    ) : (
                      <div className="add-view__placeholder">
                        <p>
                          {canUpload
                            ? 'Upload a clothing photo for AI classification'
                            : 'Waiting for backend before uploads are enabled'}
                        </p>
                      </div>
                    )}
                  </LoadingOverlay>

                  <div className="add-view__actions" onPointerDown={e => e.stopPropagation()}>
                    <button
                      type="button"
                      className="b1-compact"
                      disabled={!canUpload}
                      title={!canUpload ? statusLabel : 'Add clothing image'}
                      onClick={() => document.getElementById('fileInput')?.click()}
                    >
                      Add Image
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <nav
              className="swipe-chrome"
              aria-label="Views"
              onPointerDown={e => e.stopPropagation()}
            >
              <div className="swipe-dots">
                {VIEW_LABELS.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    className={`swipe-dot${viewIndex === i ? ' swipe-dot--active' : ''}`}
                    aria-label={label}
                    aria-current={viewIndex === i ? 'page' : undefined}
                    onClick={() => setViewIndex(i as SwipeView)}
                  />
                ))}
              </div>
              <button type="button" className="swipe-logout" onClick={logout}>
                Logout
              </button>
            </nav>
          </div>

          <input id="fileInput" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
        </>
      ) : (
        <div className="landing-auth">
          <div className="landing-auth__card">
            <h2 className="landing-auth__title">Sign in to continue</h2>
            <p className="landing-auth__subtitle">Connect your Google account to start building your smart wardrobe.</p>
            {import.meta.env.PROD && (
              <p className="landing-auth__origin" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>
                Site origin for Google OAuth: <code>{window.location.origin}</code>
              </p>
            )}
            {authError && (
              <p className="landing-auth__error" style={{ fontSize: '13px', color: '#fca5a5', marginBottom: 8 }}>
                {authError}
              </p>
            )}
            <div className="landing-auth__button">
              <GoogleLogin
                onSuccess={credentialResponse => {
                  setAuthError('');
                  const decoded: any = jwtDecode(credentialResponse.credential || '');
                  setUser(decoded);
                  setShowWelcome(true);
                  fetch(apiPath('/api/auth'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id_token: credentialResponse.credential }),
                  });
                }}
                onError={() => {
                  setAuthError(
                    `Google blocked this site. In Google Cloud Console, add "${window.location.origin}" under Authorized JavaScript origins for your Web client ID (no trailing slash).`
                  );
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const LANDING_FEATURES: {
  id: string;
  icon: string;
  title: string;
  desc: string;
  detail: string;
  preview?: [string, string];
}[] = [
  {
    id: 'weather',
    icon: '🌦️',
    title: 'Weather-aware outfits',
    desc: 'Suggestions adapt to rain, temperature, and your day.',
    detail: 'Pick any forecast day and FabAI balances warmth, layers, and rain-friendly pieces from your closet.',
  },
  {
    id: 'classifier',
    icon: '👕',
    title: 'AI wardrobe tagging',
    desc: 'Upload clothes and let the model classify them instantly.',
    detail: 'Snap a photo of any garment and FabAI labels it, categorizes it, and adds it to your inventory.',
   
  },
  {
    id: 'palette',
    icon: '🎨',
    title: 'Colour coordination',
    desc: 'Match palettes like accent + black or earth and sky.',
    detail: 'Set a colour preset per day so every suggested outfit works together harmoniously.',
  },
];

export function Main() {
  const [activeFeature, setActiveFeature] = React.useState<string | null>(null);

  const toggleFeature = (id: string) => {
    setActiveFeature(prev => (prev === id ? null : id));
  };

  return (
    <div className="landing">
      <section className="landing-hero">
        <p className="landing-hero__eyebrow">Personal wardrobe assistant</p>
        <h1 className="landing-hero__title">
          Dress smarter.<br />
          <span>Every day.</span>
        </h1>
        <p className="landing-hero__subtitle">
          FabAI reads the forecast, understands your closet, and suggests outfits that fit the weather and your style.
        </p>
      </section>

      <section className="landing-features" aria-label="Features">
        {LANDING_FEATURES.map(feature => {
          const active = activeFeature === feature.id;
          return (
            <article
              key={feature.id}
              className={`landing-feature${active ? ' landing-feature--active' : ''}`}
              onMouseEnter={() => setActiveFeature(feature.id)}
              onMouseLeave={() => setActiveFeature(null)}
              onClick={() => toggleFeature(feature.id)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleFeature(feature.id);
                }
              }}
              role="button"
              tabIndex={0}
              aria-expanded={active}
            >
              <div className="landing-feature__glow" aria-hidden="true" />
              <span className="landing-feature__icon">{feature.icon}</span>
              <h3 className="landing-feature__title">{feature.title}</h3>
              <p className="landing-feature__desc">{feature.desc}</p>
              <p className="landing-feature__detail">{feature.detail}</p>
              {'preview' in feature && feature.preview ? (
                <div className="landing-feature__preview" aria-hidden={!active}>
                  <img src={feature.preview[0]} alt="" />
                  <img src={feature.preview[1]} alt="" />
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}

export function Card(props: any) {
  const bg = props.bg === true ? { "backgroundImage": `url("${props.img}")` } : { "backgroundImage": "", "backgroundColor": "rgba(0, 0, 0, 0)" };
  const cardFeature = (
    <div className='cardFeature' style={bg}>
      <h1>{props.title}</h1>
      <h2>{props.content}</h2>
    </div>
  );
  const cardMain = (
    <div className='cardMain' style={bg}>
      <h2>{props.title}</h2>
      <h3>{props.content}</h3>
    </div>
  );
  let active = false;
  const [expanded, setExpanded] = React.useState(false);
  const [contents,     setContents]     = React.useState({ "display": "none", "opacity": "0", "transition": "2s", "transitionDelay": "4.5s" });
  const [subContents1, setSubContents1] = React.useState({ "display": "block", "transition": "2s", "opacity": "0" });
  const [subContents2, setSubContents2] = React.useState({ "display": "block", "opacity": "0", "transition": "2s", "transitionDelay": "0s" });

  React.useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
      setExpanded(true);
      setContents({ "display": "inline-flex", "opacity": "1", "transition": "2s", "transitionDelay": "0s" });
      setSubContents1({ "display": "block", "opacity": "1", "transition": "2s" });
      setSubContents2({ "display": "block", "opacity": "1", "transition": "2s", "transitionDelay": "0s" });
    }
  }, []);

  const cardSub = (
    <div className={`cardSub${expanded ? ' cardSub--expanded' : ''}`}
      onClick={() => {
        if (!window.matchMedia('(max-width: 768px)').matches) return;
        setExpanded(v => {
          const next = !v;
          if (next) {
            setContents({ "display": "inline-flex", "opacity": "1", "transition": "2s", "transitionDelay": "0s" });
            setSubContents1({ "display": "block", "opacity": "1", "transition": "2s" });
            setSubContents2({ "display": "block", "opacity": "1", "transition": "2s", "transitionDelay": "0s" });
          } else {
            setContents({ "display": "none", "opacity": "0", "transition": "0s", "transitionDelay": "0s" });
            setSubContents1({ "display": "none", "opacity": "0", "transition": "2s" });
            setSubContents2({ "display": "none", "opacity": "0", "transition": "2s", "transitionDelay": "0s" });
          }
          return next;
        });
      }}
      onMouseOver={() => {
        active = true;
        if (active) {
          setTimeout(setSubContents1, 0, { "display": "block", "opacity": "0" });
          setTimeout(setSubContents2, 0, { "display": "block", "opacity": "0" });
          setContents({ "display": "inline-flex", "opacity": "1", "transition": "2s", "transitionDelay": "0.5s" });
          setTimeout(setSubContents1, 1000, { "opacity": "1", "transition": "2s" });
          setTimeout(setSubContents2, 1700, { "opacity": "1", "transition": "2s", "transitionDelay": "0.5s" });
        }
      }}
      onMouseLeave={() => {
        active = false;
        setTimeout(setSubContents1, 0, { "opacity": "0", "transition": "1s", "transitionDelay": "0s" });
        setTimeout(setSubContents2, 0, { "opacity": "0", "transition": "1s", "transitionDelay": "0s" });
        setTimeout(setContents,     1000, { "opacity": "0", "transition": "0s", "transitionDelay": "0.5s" });
        setTimeout(setSubContents1, 1000, { "display": "none", "opacity": "0" });
        setTimeout(setSubContents2, 1000, { "display": "none", "opacity": "0" });
        setTimeout(setContents,     1000, { "display": "none", "opacity": "0" });
      }}>
      <div className="subText">
        <h1 style={{color: "black" } }>{props.title}</h1>
        <h3>{props.content}</h3>
      </div>
      <div className="subImg" style={contents}>
        <img src={props.img}  style={subContents1}></img>
        <img src={props.img2} style={subContents2}></img>
      </div>
    </div>
  );
  if (props.display === false) return null;
  if (props.type === 'Feature') return cardFeature;
  return props.type === 'Main' ? cardMain : cardSub;
}

const navClickHandler = () => {
  window.location.assign('/');
  return 0;
};

export function Navbar() {
  return (
    <div className='nav'>
      <h1 className="nav__brand">Fab</h1>
      <img
        className="nav__logo"
        src="/CirculationsLogoNoBg.png"
        onClick={navClickHandler}
        alt="FabAI home"
      />
      <h1 className="nav__brand">AI</h1>
    </div>
  );
}

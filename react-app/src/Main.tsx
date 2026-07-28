import React, { useEffect, useState, useRef } from "react";
import { GoogleLogin, googleLogout } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { apiPath } from './config';

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
    padding: '12px 20px',
    margin: '4px 0 4px',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'white',
    width: '100%',
    boxSizing: 'border-box',
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
      <p style={{ margin: '0 0 14px', fontSize: 13, color: '#bbb', fontWeight: 500 }}>
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
          <div className="day-prefs">
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

interface InvContentProps { user: any; onClose: () => void; refreshKey: number; }

function InventoryContent({ user, onClose, refreshKey }: InvContentProps) {
  const [items,   setItems]   = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('All');

  useEffect(() => {
    if (!user?.sub) { setLoading(false); return; }
    setLoading(true);
    fetch(apiPath(`/api/inventory?user_id=${user.sub}`))
      .then(r => r.json())
      .then(d  => { setItems(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user, refreshKey]);

  const shown = filter === 'All' ? items : items.filter(x => x.category === filter);

  return (
    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 920 }}>
      <div className="modal-header">
        <h2>My Wardrobe{!loading ? ` · ${items.length} item${items.length !== 1 ? 's' : ''}` : ''}</h2>
      </div>

      {/* Category filter chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '14px 0 8px' }}>
        {CATS.map(c => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`inv-filter${filter === c ? ' inv-filter--active' : ''}`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="modal-body" style={{ minHeight: 200 }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: '#aaa', paddingTop: 40 }}>Loading wardrobe…</p>
        ) : shown.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666', paddingTop: 40 }}>
            {items.length === 0
              ? 'No items yet. Upload your first piece!'
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
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
      </div>

      <div className="modal-footer">
        <button className="modal-close-button" onClick={onClose}>Close</button>
      </div>
    </div>
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
  const [imageId,    setImageId]    = React.useState<number | null>(null);
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

  const inventoryRef = useRef<HTMLDialogElement | null>(null);
  const outfitRequestRef = useRef(0);
  const wakeAbortRef = useRef<AbortController | null>(null);

  const openWardrobe = () => {
    setInventoryRefresh(r => r + 1);
    inventoryRef.current?.showModal();
  };

  const wakeBackend = React.useCallback(async () => {
    wakeAbortRef.current?.abort();
    const ac = new AbortController();
    wakeAbortRef.current = ac;
    setBackendStatus('starting');

    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      if (ac.signal.aborted) return false;
      try {
        const r = await fetch(apiPath('/'), { signal: ac.signal });
        if (r.ok) {
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
      wakeAbortRef.current?.abort();
      return;
    }
    wakeBackend();
    return () => wakeAbortRef.current?.abort();
  }, [user, wakeBackend]);

  useEffect(() => {
    if (!user?.sub || backendStatus !== 'ready') return;

    const requestId = ++outfitRequestRef.current;
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
          return r.json();
        })
        .then(d => {
          if (requestId === outfitRequestRef.current) {
            setOutfits(Array.isArray(d) ? d : []);
          }
        })
        .catch(err => {
          console.error(err);
          if (requestId === outfitRequestRef.current) {
            setOutfits([]);
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
      // Direct API URL bypasses static-site proxy timeouts (common cause of 502).
      const r = await fetch(apiPath(`/api/classify_image/${id}`, { direct: true }), {
        method: 'POST',
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 502 || r.status === 503) {
          setBackendStatus('starting');
          wakeBackend();
        }
        throw new Error(
          typeof d.error === 'string' ? d.error : `Classification failed (${r.status})`
        );
      }
      setPrediction(String(d.prediction ?? d.label ?? ''));
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
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (r.status === 502 || r.status === 503) {
            setBackendStatus('starting');
            wakeBackend();
          }
          throw new Error(
            typeof d.error === 'string' ? d.error : `Upload failed (${r.status})`
          );
        }
        if (!d.image_id) {
          throw new Error('Upload succeeded but no image_id returned');
        }
        setImageId(d.image_id);
        setImageUrl(apiPath(`/api/image/${d.image_id}`));
        setPrediction('Saved to wardrobe. Starting AI…');
        setOutfitRefresh(x => x + 1);
        setInventoryRefresh(x => x + 1);
        await runClassification(d.image_id);
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
      ? (busy ? 'Working…' : 'Backend ready')
      : backendStatus === 'error'
        ? 'Backend offline — tap retry'
        : 'Starting backend…';

  return (
    <div className={classid}>
      {user ? (
        <>
          {/* ── Inventory Modal ── */}
          <dialog ref={inventoryRef} onClick={() => inventoryRef.current?.close()}>
            <InventoryContent
              user={user}
              refreshKey={inventoryRefresh}
              onClose={() => inventoryRef.current?.close()}
            />
          </dialog>

          {showWelcome && (
            <WelcomeToast name={user.name} onDone={() => setShowWelcome(false)} />
          )}

          <div className="dashboard-layout">
            <div className="dashboard-sidebar">
              <WeatherWidget
                onDaySelect={handleDaySelect}
                formality={formality}
                colorPreset={colorPreset}
                onFormalityChange={handleFormalityChange}
                onColorPresetChange={handleColorPresetChange}
              />

              <div className="prediction-box">
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
                {imageUrl ? (
                  <>
                    <img src={imageUrl} alt="Last Uploaded" className="last-uploaded-img" />
                    <p>AI Classifier: <strong>{prediction || 'Processing...'}</strong></p>
                  </>
                ) : (
                  <p style={{color: '#666', fontSize: '14px'}}>
                    {canUpload
                      ? 'Upload an image to see AI classification'
                      : 'Waiting for backend before uploads are enabled'}
                  </p>
                )}
              </div>

              <div className="dashboard-controls">
                <button
                  className="b1-compact"
                  disabled={!canUpload}
                  title={!canUpload ? statusLabel : 'Add clothing image'}
                  onClick={() => document.getElementById('fileInput')?.click()}
                >
                  Add Image
                </button>
                <button className="b1-compact" onClick={openWardrobe}>
                  Wardrobe
                </button>
                <button className="b1-compact" onClick={() => { googleLogout(); setUser(null); setClassid(''); }}>
                  Logout
                </button>
              </div>
            </div>

            <div className="dashboard-main">
              <div className="outfits-container">
                <h3>Outfit Suggestions for {selectedDay}{formality === 'formal' ? ' (Formal)' : ''}</h3>
                {outfits.length > 0 ? (
                  <div className="outfits-list">
                    {outfits.map((off, idx) => (
                      <div key={idx} className="outfit-card">
                        <h4>Option {idx + 1}</h4>
                        <div className="outfit-grid-compact">
                          {Object.entries(off).map(([part, item]) => item && (
                            <div key={part} className="outfit-item-compact">
                              <img src={apiPath(`/api/image/${item.id}`)} alt={item.label} />
                              <span className="outfit-item-label-compact">
                                {item.label}
                                {item.color && <span className="outfit-item-color"> · {item.color}</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-outfits">
                    <p>Not enough items in your wardrobe to suggest an outfit for this weather.</p>
                    <p style={{fontSize: '13px', color: '#888'}}>Try adding more Tops, Bottoms, and Shoes!</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'none', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="b1" onClick={() => document.getElementById('fileInput')?.click()}>
              <h4>Add Image</h4>
            </button>
            <button className="b1" onClick={openWardrobe}>
              <h4>View Inventory</h4>
            </button>
            <button className="b1" onClick={() => { googleLogout(); setUser(null); setClassid(''); }}>
              <h4>Logout</h4>
            </button>
          </div>
          <input id="fileInput" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
        </>
      ) : (
        <div className="landing-auth">
          <div className="landing-auth__card">
            <h2 className="landing-auth__title">Sign in to continue</h2>
            <p className="landing-auth__subtitle">Connect your Google account to start building your smart wardrobe.</p>
            <div className="landing-auth__button">
              <GoogleLogin
                onSuccess={credentialResponse => {
                  const decoded: any = jwtDecode(credentialResponse.credential || '');
                  setUser(decoded);
                  setShowWelcome(true);
                  fetch(apiPath('/api/auth'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id_token: credentialResponse.credential }),
                  });
                }}
                onError={() => console.log('Login Failed')}
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

import React, { useEffect, useState, useRef } from "react";
import { GoogleLogin, googleLogout } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

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

interface InvContentProps { user: any; onClose: () => void; }

function InventoryContent({ user, onClose }: InvContentProps) {
  const [items,   setItems]   = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('All');

  useEffect(() => {
    if (!user?.sub) { setLoading(false); return; }
    fetch(`http://localhost:5000/api/inventory?user_id=${user.sub}`)
      .then(r => r.json())
      .then(d  => { setItems(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

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
                    src={`http://localhost:5000/api/image/${item.id}`}
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
                      fetch(`http://localhost:5000/api/inventory/${item.id}`, {
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
                        fetch(`http://localhost:5000/api/inventory/${item.id}`, {
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
                          fetch(`http://localhost:5000/api/inventory/${item.id}`, { method: 'DELETE' })
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
  const [showWelcome, setShowWelcome] = React.useState(false);

  const inventoryRef = useRef<HTMLDialogElement | null>(null);
  const outfitRequestRef = useRef(0);

  useEffect(() => { setClassid(user ? 'b2' : '') }, [user]);

  useEffect(() => {
    if (!user) setShowWelcome(false);
  }, [user]);

  useEffect(() => {
    if (!user?.sub) return;

    const requestId = ++outfitRequestRef.current;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        user_id: user.sub,
        target: String(outfitTarget),
        weather_code: String(weatherCode),
        formality,
        color_preset: colorPreset,
      });

      fetch(`http://localhost:5000/api/outfit?${params}`)
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
  }, [user, outfitTarget, weatherCode, formality, colorPreset, outfitRefresh]);

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

  const handlePredict = async (id: number) => {
    try {
      const r = await fetch(`http://localhost:5000/api/predict_image/${id}`);
      const d = await r.json();
      setPrediction(d.prediction);
    } catch (err) { console.error(err); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPrediction('Uploading...');

    const formData = new FormData();
    formData.append('image', file);
    formData.append('user_info', JSON.stringify(user));

    fetch('http://localhost:5000/api/uploadnx', { method: 'POST', body: formData })
      .then(r => r.json())
      .then(d => {
        setImageId(d.image_id);
        setImageUrl(`http://localhost:5000/api/image/${d.image_id}`);
        handlePredict(d.image_id);
        setOutfitRefresh(r => r + 1);
      })
      .catch(console.error);
  };

  return (
    <div className={classid}>
      {user ? (
        <>
          {/* ── Inventory Modal ── */}
          <dialog ref={inventoryRef} onClick={() => inventoryRef.current?.close()}>
            <InventoryContent user={user} onClose={() => inventoryRef.current?.close()} />
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
                {imageUrl ? (
                  <>
                    <img src={imageUrl} alt="Last Uploaded" className="last-uploaded-img" />
                    <p>AI Classifier: <strong>{prediction || 'Processing...'}</strong></p>
                  </>
                ) : (
                  <p style={{color: '#666', fontSize: '14px'}}>Upload an image to see AI classification</p>
                )}
              </div>

              <div className="dashboard-controls">
                <button className="b1-compact" onClick={() => document.getElementById('fileInput')?.click()}>
                  Add Image
                </button>
                <button className="b1-compact" onClick={() => inventoryRef.current?.showModal()}>
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
                              <img src={`http://localhost:5000/api/image/${item.id}`} alt={item.label} />
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
            <button className="b1" onClick={() => inventoryRef.current?.showModal()}>
              <h4>View Inventory</h4>
            </button>
            <button className="b1" onClick={() => { googleLogout(); setUser(null); setClassid(''); }}>
              <h4>Logout</h4>
            </button>
          </div>
          <input id="fileInput" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
        </>
      ) : (
        <GoogleLogin
          onSuccess={credentialResponse => {
            const decoded: any = jwtDecode(credentialResponse.credential || '');
            setUser(decoded);
            setShowWelcome(true);
            fetch('http://localhost:5000/api/auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id_token: credentialResponse.credential }),
            });
          }}
          onError={() => console.log('Login Failed')}
        />
      )}
    </div>
  );
}

export function Main(props: any) {
  return (
    <>
      <div>
        <Card title="Innovation" content="Welcome to FabAI" type="Feature" img="" bg={true} />
      </div>
      <div className="Main">
        <div className="bg">
          <Card title="AI Classifier" content="Use our AI model to add clothes to your inventory" type="Sub" img="/shirt.png" img2="/shoes.png" bg={true} />
        </div>
      </div>
    </>
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
  window.location.assign('http://localhost:3000/');
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

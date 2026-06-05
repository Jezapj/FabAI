import React, { useEffect, useState, useRef } from "react";
import { GoogleLogin, googleLogout } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

// ── Types ────────────────────────────────────────────────────────────────────
interface OutfitItem { id: number; label: string; value: number; category: string; }
interface Outfit     { [key: string]: OutfitItem | null; }
interface WeatherDay { date: string; maxTemp: number; minTemp: number; weatherCode: number; }
interface InvItem    { id: number; label: string; value: number; category: string; }

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

function dayLabel(dateStr: string, i: number): string {
  if (i === 0) return 'Today';
  if (i === 1) return 'Tmrw';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short' });
}

// ── Temperature → warmth target conversion ───────────────────────────────────
// Maps °C to 0-100 where 0 = very hot (light clothes), 100 = very cold (heavy)
// Calibrated for range -10 °C (100) → 45 °C (0)
function tempToTarget(maxTemp: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - ((maxTemp + 10) / 55) * 100)));
}

// ── Weather Widget ────────────────────────────────────────────────────────────
interface WeatherWidgetProps {
  onDaySelect?: (maxTemp: number, label: string) => void;
}

function WeatherWidget({ onDaySelect }: WeatherWidgetProps) {
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
        setForecast(d.daily.time.map((date: string, i: number) => ({
          date,
          maxTemp: Math.round(d.daily.temperature_2m_max[i]),
          minTemp: Math.round(d.daily.temperature_2m_min[i]),
          weatherCode: d.daily.weathercode[i],
        })));
        // Notify parent with today's temperature on first load
        if (onDaySelect) {
          onDaySelect(Math.round(d.daily.temperature_2m_max[0]), 'Today');
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
    padding: '18px 20px',
    margin: '12px 0 16px',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'white',
    width: '100%',
    boxSizing: 'border-box',
  };

  if (status === 'loading') return (
    <div style={wrap}>
      <p style={{ textAlign: 'center', color: '#aaa', margin: 0, fontSize: 13 }}>Loading forecast…</p>
    </div>
  );
  if (status === 'error') return (
    <div style={wrap}>
      <p style={{ textAlign: 'center', color: '#666', margin: 0, fontSize: 13 }}>Weather unavailable</p>
    </div>
  );

  return (
    <div style={wrap}>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: '#bbb', fontWeight: 500 }}>
        📍 {city} &mdash; Weekly Forecast
      </p>
      <div className="weather-strip">
        {forecast.map((day, i) => {
          const [emoji, label] = wmo(day.weatherCode);
          const today    = i === 0;
          const selected = i === selectedIdx;
          const classes  = [
            'weather-day',
            today    ? 'weather-day--today'    : '',
            selected && !today ? 'weather-day--selected' : '',
          ].filter(Boolean).join(' ');
          return (
            <div
              key={day.date}
              className={classes}
              onClick={() => {
                setSelectedIdx(i);
                if (onDaySelect) onDaySelect(day.maxTemp, dayLabel(day.date, i));
              }}
              title={`Select ${dayLabel(day.date, i)} — ${day.maxTemp}°C`}
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
        <p className="weather-day--target-label">
          🧥 Outfit suggestions will be tailored for <strong style={{ color: '#e2e8f0' }}>{dayLabel(forecast[selectedIdx].date, selectedIdx)}</strong> · {forecast[selectedIdx].maxTemp}°C · warmth target {tempToTarget(forecast[selectedIdx].maxTemp)}/100
        </p>
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
              ? 'No items yet — upload your first piece!'
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
                  <div className="inv-item__label">{item.label}</div>
                  <span
                    className="inv-item__cat"
                    style={{ background: CAT_COLORS[item.category] ?? 'rgba(255,255,255,.1)' }}
                  >
                    {item.category}
                  </span>
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

// ── Login / Dashboard ─────────────────────────────────────────────────────────
export function Login() {
  const [user,       setUser]       = React.useState<any>(null);
  const [classid,    setClassid]    = React.useState<any>('');
  const [prediction, setPrediction] = React.useState('');
  const [outfit,     setOutfit]     = React.useState<Outfit | null>(null);
  const [imageId,    setImageId]    = React.useState(1);
  const [imageUrl,   setImageUrl]   = React.useState('');
  const [outfitTarget, setOutfitTarget] = React.useState(50);
  const [selectedDay,  setSelectedDay]  = React.useState('Today');

  const dialogRef   = useRef<HTMLDialogElement | null>(null);
  const inventoryRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => { setClassid(user ? 'b2' : '') }, [user]);

  const handleDaySelect = (maxTemp: number, label: string) => {
    setOutfitTarget(tempToTarget(maxTemp));
    setSelectedDay(label);
  };

  const handlePredict = async () => {
    try {
      const r = await fetch(`http://localhost:5000/api/predict_image/${imageId}`);
      const d = await r.json();
      setPrediction(d.prediction);
    } catch (err) { console.error(err); }
  };

  const handleOutfit = () => {
    const userId = user?.sub;
    if (!userId) return;
    fetch(`http://localhost:5000/api/outfit?user_id=${userId}&target=${outfitTarget}`)
      .then(r => r.json())
      .then(d => setOutfit(d))
      .catch(console.error);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOutfit(null);
    setPrediction('');

    const formData = new FormData();
    formData.append('image', file);
    formData.append('user_info', JSON.stringify(user));

    fetch('http://localhost:5000/api/uploadnx', { method: 'POST', body: formData })
      .then(r => r.json())
      .then(d => {
        setImageId(d.image_id);
        setImageUrl(`http://localhost:5000/api/image/${d.image_id}`);
        dialogRef.current?.showModal();
      })
      .catch(console.error);
  };

  return (
    <div className={classid}>
      {user ? (
        <>
          {/* ── Upload / Predict Modal ── */}
          <dialog ref={dialogRef} onClick={() => dialogRef.current?.close()}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header"><h2>AI Image Analysis</h2></div>
              <div className="modal-body">
                <div className="uploaded-image-section">
                  <img className="imageStyle" src={imageUrl} alt="Uploaded" />
                  {prediction && (
                    <div className="prediction-result"><h3>AI Prediction: {prediction}</h3></div>
                  )}
                </div>
                {outfit && (
                  <div className="outfit-section">
                    <hr /><h2>Outfit for {selectedDay}</h2>
                    <div className="outfit-grid">
                      {Object.entries(outfit).map(([part, item]) => item && (
                        <div key={part} className="outfit-item">
                          <img src={`http://localhost:5000/api/image/${item.id}`} alt={item.label} />
                          <div className="outfit-item-info">
                            <span className="outfit-item-category">{part.toUpperCase()}</span>
                            <span className="outfit-item-label">{item.label}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="modal-close-button" onClick={() => { dialogRef.current?.close(); setPrediction(''); setOutfit(null); }}>
                  Close
                </button>
                <button className="modal-action-button" onClick={handlePredict}>Predict</button>
                <button className="modal-action-button" onClick={handleOutfit}>Suggest Outfit</button>
              </div>
            </div>
          </dialog>

          {/* ── Inventory Modal ── */}
          <dialog ref={inventoryRef} onClick={() => inventoryRef.current?.close()}>
            <InventoryContent user={user} onClose={() => inventoryRef.current?.close()} />
          </dialog>

          {/* ── Dashboard ── */}
          <Card title={`Welcome, ${user.name}`} content="Your personal wardrobe assistant" type="Main" bg={false} />

          <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 16px', width: '100%', boxSizing: 'border-box' }}>
            <WeatherWidget onDaySelect={handleDaySelect} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
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
          <Card title="AI Classifier" content="Use our AI model to add clothes to your inventory" type="Sub" img="src/assets/shirt.png" img2="src/assets/shoes.png" bg={true} />
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
  const [contents,     setContents]     = React.useState({ "display": "none", "opacity": "0", "transition": "2s", "transition-delay": "4.5s" });
  const [subContents1, setSubContents1] = React.useState({ "display": "block", "transition": "2s", "opacity": "0" });
  const [subContents2, setSubContents2] = React.useState({ "display": "block", "opacity": "0" });
  const cardSub = (
    <div className='cardSub'
      onMouseOver={() => {
        active = true;
        if (active) {
          setTimeout(setSubContents1, 0, { "display": "block", "opacity": "0" });
          setTimeout(setSubContents2, 0, { "display": "block", "opacity": "0" });
          setContents({ "display": "inline-flex", "opacity": "1", "transition": "2s", "transition-delay": "0.5s" });
          setTimeout(setSubContents1, 1000, { "opacity": "1", "transition": "2s" });
          setTimeout(setSubContents2, 1700, { "opacity": "1", "transition": "2s", "transition-delay": "0.5s" });
        }
      }}
      onMouseLeave={() => {
        active = false;
        setTimeout(setSubContents1, 0, { "opacity": "0", "transition": "1s", "transition-delay": "0s" });
        setTimeout(setSubContents2, 0, { "opacity": "0", "transition": "1s", "transition-delay": "0s" });
        setTimeout(setContents,     1000, { "opacity": "0", "transition": "0s", "transition-delay": "0.5s" });
        setTimeout(setSubContents1, 1000, { "display": "none", "opacity": "0" });
        setTimeout(setSubContents2, 1000, { "display": "none", "opacity": "0" });
        setTimeout(setContents,     1000, { "display": "none", "opacity": "0" });
      }}>
      <div className="subText">
        <h1>{props.title}</h1>
        <h3>{props.content}</h3>
      </div>
      <div className="subImg" style={contents}>
        <img src={props.img}  style={subContents1}></img>
        <img src={props.img2} style={subContents2}></img>
      </div>
    </div>
  );
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
      <h1>Fab</h1>
      <img src="src/assets/CirculationsLogoNoBg.png" onClick={navClickHandler} height="80px" width="100px" />
      <h1>AI</h1>
    </div>
  );
}
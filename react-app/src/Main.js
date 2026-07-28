var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useEffect, useState, useRef } from "react";
import { GoogleLogin, googleLogout } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { apiPath } from './config';
// ── WMO weather-code table ───────────────────────────────────────────────────
const WMO = {
    0: ['☀️', 'Clear sky'], 1: ['🌤️', 'Mainly clear'],
    2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Overcast'],
    45: ['🌫️', 'Fog'], 48: ['🌫️', 'Icy fog'],
    51: ['🌦️', 'Light drizzle'], 53: ['🌦️', 'Drizzle'],
    55: ['🌧️', 'Heavy drizzle'], 61: ['🌧️', 'Light rain'],
    63: ['🌧️', 'Rain'], 65: ['🌧️', 'Heavy rain'],
    71: ['🌨️', 'Light snow'], 73: ['❄️', 'Snow'],
    75: ['❄️', 'Heavy snow'], 77: ['🌨️', 'Snow grains'],
    80: ['🌦️', 'Showers'], 81: ['🌧️', 'Rain showers'],
    82: ['⛈️', 'Heavy showers'], 95: ['⛈️', 'Thunderstorm'],
    96: ['⛈️', 'Storm + hail'], 99: ['⛈️', 'Storm + hail'],
};
const wmo = (code) => { var _a; return (_a = WMO[code]) !== null && _a !== void 0 ? _a : ['🌡️', 'Unknown']; };
const RAIN_CODES = new Set([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99]);
const COLOR_PRESETS = [
    { id: 'any', label: 'Any colours' },
    { id: 'accent_black', label: 'Single accent + black' },
    { id: 'earth_sky', label: 'Light brown + light blue' },
    { id: 'neutrals', label: 'Neutrals only' },
];
function isRainy(code) {
    return RAIN_CODES.has(code);
}
function defaultDayPrefs() {
    return { formality: 'casual', colorPreset: 'any' };
}
function dayLabel(dateStr, i) {
    if (i === 0)
        return 'Today';
    if (i === 1)
        return 'Tmrw';
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short' });
}
// ── Temperature → warmth target conversion ───────────────────────────────────
// Maps °C to 0-100 where 0 = very hot (light clothes), 100 = very cold (heavy)
// Calibrated for range -10 °C (100) → 45 °C (0)
// Uses a sigmoid to make differences around 15-25°C more pronounced
function tempToTarget(maxTemp) {
    const x = maxTemp;
    const sigmoid = 1 / (1 + Math.exp(0.15 * (x - 18)));
    return Math.round(sigmoid * 100);
}
function WeatherWidget({ onDaySelect, formality, colorPreset, onFormalityChange, onColorPresetChange, }) {
    var _a;
    const [forecast, setForecast] = useState([]);
    const [city, setCity] = useState('');
    const [status, setStatus] = useState('loading');
    const [selectedIdx, setSelectedIdx] = useState(0);
    useEffect(() => {
        function load(lat, lon) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const r = yield fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
                        `&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=7`);
                    const d = yield r.json();
                    const days = d.daily.time.map((date, i) => ({
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
                }
                catch (_a) {
                    setStatus('error');
                }
            });
        }
        if (!navigator.geolocation) {
            load(-37.8136, 144.9631);
            setCity('Melbourne');
            return;
        }
        navigator.geolocation.getCurrentPosition((pos) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            load(pos.coords.latitude, pos.coords.longitude);
            try {
                const g = yield fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
                const gd = yield g.json();
                setCity((_f = (_d = (_b = (_a = gd.address) === null || _a === void 0 ? void 0 : _a.city) !== null && _b !== void 0 ? _b : (_c = gd.address) === null || _c === void 0 ? void 0 : _c.town) !== null && _d !== void 0 ? _d : (_e = gd.address) === null || _e === void 0 ? void 0 : _e.suburb) !== null && _f !== void 0 ? _f : 'Your Location');
            }
            catch (_g) {
                setCity('Your Location');
            }
        }), () => { load(-37.8136, 144.9631); setCity('Melbourne'); }, { timeout: 5000 });
    }, []);
    const wrap = {
        background: 'rgba(0,0,0,0.72)',
        borderRadius: 14,
        padding: '12px 20px',
        margin: '4px 0 4px',
        border: '1px solid rgba(255,255,255,0.08)',
        color: 'white',
        width: '100%',
        boxSizing: 'border-box',
    };
    if (status === 'loading')
        return (_jsx("div", { className: "weather-widget", style: wrap, children: _jsx("p", { style: { textAlign: 'center', color: '#aaa', margin: 0, fontSize: 13 }, children: "Loading forecast\u2026" }) }));
    if (status === 'error')
        return (_jsx("div", { className: "weather-widget", style: wrap, children: _jsx("p", { style: { textAlign: 'center', color: '#666', margin: 0, fontSize: 13 }, children: "Weather unavailable" }) }));
    return (_jsxs("div", { className: "weather-widget", style: wrap, children: [_jsxs("p", { style: { margin: '0 0 14px', fontSize: 13, color: '#bbb', fontWeight: 500 }, children: ["\uD83D\uDCCD ", city, " \u00B7 Weekly Forecast"] }), _jsx("div", { className: "weather-strip", children: forecast.map((day, i) => {
                    const [emoji, label] = wmo(day.weatherCode);
                    const today = i === 0;
                    const selected = i === selectedIdx;
                    const classes = [
                        'weather-day',
                        today ? 'weather-day--today' : '',
                        selected ? 'weather-day--selected' : '',
                    ].filter(Boolean).join(' ');
                    return (_jsxs("div", { className: classes, onClick: () => {
                            setSelectedIdx(i);
                            if (onDaySelect)
                                onDaySelect(day, dayLabel(day.date, i));
                        }, title: `Select ${dayLabel(day.date, i)}, ${day.maxTemp}°C${isRainy(day.weatherCode) ? ' · rainy' : ''}`, children: [_jsx("div", { className: "weather-day__name", children: dayLabel(day.date, i) }), _jsx("div", { className: "weather-day__icon", children: emoji }), _jsx("div", { className: "weather-day__desc", children: label }), _jsxs("div", { className: "weather-day__max", children: [day.maxTemp, "\u00B0"] }), _jsxs("div", { className: "weather-day__min", children: [day.minTemp, "\u00B0"] })] }, day.date));
                }) }), forecast.length > 0 && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "day-prefs", children: [_jsxs("div", { className: "day-prefs__group", children: [_jsx("span", { className: "day-prefs__label", children: "Style" }), _jsxs("div", { className: "day-prefs__toggle", children: [_jsx("button", { type: "button", className: `day-prefs__btn${formality === 'casual' ? ' day-prefs__btn--active' : ''}`, onClick: () => onFormalityChange('casual'), children: "Casual" }), _jsx("button", { type: "button", className: `day-prefs__btn${formality === 'formal' ? ' day-prefs__btn--active' : ''}`, onClick: () => onFormalityChange('formal'), children: "Formal" })] })] }), _jsxs("div", { className: "day-prefs__group", children: [_jsx("label", { className: "day-prefs__label", htmlFor: "color-preset", children: "Colour palette" }), _jsx("select", { id: "color-preset", className: "day-prefs__select", value: colorPreset, onChange: e => onColorPresetChange(e.target.value), children: COLOR_PRESETS.map(p => (_jsx("option", { value: p.id, children: p.label }, p.id))) })] })] }), _jsxs("p", { className: "weather-day--target-label", children: ["\uD83E\uDDE5 Suggestions for ", _jsx("strong", { style: { color: '#e2e8f0' }, children: dayLabel(forecast[selectedIdx].date, selectedIdx) }), ' · ', forecast[selectedIdx].maxTemp, "\u00B0C", ' · ', "warmth ", tempToTarget(forecast[selectedIdx].maxTemp), "/100", isRainy(forecast[selectedIdx].weatherCode) && ' · 🌧️ rain-aware', formality === 'formal' && ' · 👔 formal', colorPreset !== 'any' && ` · ${(_a = COLOR_PRESETS.find(p => p.id === colorPreset)) === null || _a === void 0 ? void 0 : _a.label.toLowerCase()}`] })] }))] }));
}
// ── Inventory Modal ───────────────────────────────────────────────────────────
const CATS = ['All', 'Top', 'Bottom', 'Shoes', 'Optional', 'Head', 'One piece'];
const CAT_COLORS = {
    'Top': 'rgba(80,150,255,.25)',
    'Bottom': 'rgba(80,200,120,.25)',
    'Shoes': 'rgba(255,180,60,.25)',
    'Optional': 'rgba(180,100,255,.25)',
    'Head': 'rgba(255,120,120,.25)',
    'One piece': 'rgba(255,160,80,.25)',
};
function InventoryContent({ user, onClose, refreshKey }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('All');
    useEffect(() => {
        if (!(user === null || user === void 0 ? void 0 : user.sub)) {
            setLoading(false);
            return;
        }
        setLoading(true);
        fetch(apiPath(`/api/inventory?user_id=${user.sub}`))
            .then(r => r.json())
            .then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false); })
            .catch(() => setLoading(false));
    }, [user, refreshKey]);
    const shown = filter === 'All' ? items : items.filter(x => x.category === filter);
    return (_jsxs("div", { className: "modal-content", onClick: e => e.stopPropagation(), style: { maxWidth: 920 }, children: [_jsx("div", { className: "modal-header", children: _jsxs("h2", { children: ["My Wardrobe", !loading ? ` · ${items.length} item${items.length !== 1 ? 's' : ''}` : ''] }) }), _jsx("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap', padding: '14px 0 8px' }, children: CATS.map(c => (_jsx("button", { onClick: () => setFilter(c), className: `inv-filter${filter === c ? ' inv-filter--active' : ''}`, children: c }, c))) }), _jsx("div", { className: "modal-body", style: { minHeight: 200 }, children: loading ? (_jsx("p", { style: { textAlign: 'center', color: '#aaa', paddingTop: 40 }, children: "Loading wardrobe\u2026" })) : shown.length === 0 ? (_jsx("p", { style: { textAlign: 'center', color: '#666', paddingTop: 40 }, children: items.length === 0
                        ? 'No items yet. Upload your first piece!'
                        : `No ${filter} items in your wardrobe.` })) : (_jsx("div", { className: "inv-grid", children: shown.map(item => {
                        var _a;
                        return (_jsxs("div", { className: "inv-item", children: [_jsx("div", { className: "inv-item__img-wrap", children: _jsx("img", { src: apiPath(`/api/image/${item.id}`), alt: item.label, className: "inv-item__img" }) }), _jsxs("div", { className: "inv-item__info", children: [_jsx("input", { className: "inv-item__label-input", value: item.label, onChange: (e) => {
                                                const newLabel = e.target.value;
                                                setItems(prev => prev.map(i => i.id === item.id ? Object.assign(Object.assign({}, i), { label: newLabel }) : i));
                                            }, onBlur: (e) => {
                                                fetch(apiPath(`/api/inventory/${item.id}`), {
                                                    method: 'PATCH',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ label: e.target.value })
                                                });
                                            } }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }, children: [_jsx("select", { className: "inv-item__cat-select", value: item.category, onChange: (e) => {
                                                        const newCat = e.target.value;
                                                        fetch(apiPath(`/api/inventory/${item.id}`), {
                                                            method: 'PATCH',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ category: newCat })
                                                        })
                                                            .then(r => r.json())
                                                            .then(updated => {
                                                            setItems(prev => prev.map(i => i.id === item.id ? Object.assign(Object.assign({}, i), { category: updated.category, value: updated.value }) : i));
                                                        });
                                                    }, style: { background: (_a = CAT_COLORS[item.category]) !== null && _a !== void 0 ? _a : 'rgba(255,255,255,.1)' }, children: CATS.filter(c => c !== 'All').map(c => _jsx("option", { value: c, children: c }, c)) }), _jsx("button", { className: "inv-item__delete", onClick: () => {
                                                        if (window.confirm('Delete this item?')) {
                                                            fetch(apiPath(`/api/inventory/${item.id}`), { method: 'DELETE' })
                                                                .then(() => setItems(prev => prev.filter(i => i.id !== item.id)));
                                                        }
                                                    }, children: "\uD83D\uDDD1\uFE0F" })] })] })] }, item.id));
                    }) })) }), _jsx("div", { className: "modal-footer", children: _jsx("button", { className: "modal-close-button", onClick: onClose, children: "Close" }) })] }));
}
// ── Welcome toast on login ────────────────────────────────────────────────────
function WelcomeToast({ name, onDone }) {
    const [fading, setFading] = React.useState(false);
    useEffect(() => {
        const fadeTimer = window.setTimeout(() => setFading(true), 1500);
        const hideTimer = window.setTimeout(onDone, 2000);
        return () => {
            window.clearTimeout(fadeTimer);
            window.clearTimeout(hideTimer);
        };
    }, [onDone]);
    return (_jsx("div", { className: `welcome-toast${fading ? ' welcome-toast--fading' : ''}`, role: "status", "aria-live": "polite", children: _jsxs("div", { className: "welcome-toast__content", children: [_jsxs("h2", { children: ["Welcome, ", name] }), _jsx("p", { children: "Your personal wardrobe assistant" })] }) }));
}
// ── Login / Dashboard ─────────────────────────────────────────────────────────
export function Login({ user, setUser }) {
    const [classid, setClassid] = React.useState('');
    const [prediction, setPrediction] = React.useState('');
    const [outfits, setOutfits] = React.useState([]);
    const [imageId, setImageId] = React.useState(null);
    const [imageUrl, setImageUrl] = React.useState('');
    const [outfitTarget, setOutfitTarget] = React.useState(50);
    const [selectedDay, setSelectedDay] = React.useState('Today');
    const [selectedDate, setSelectedDate] = React.useState('');
    const [weatherCode, setWeatherCode] = React.useState(0);
    const [formality, setFormality] = React.useState('casual');
    const [colorPreset, setColorPreset] = React.useState('any');
    const [dayPrefs, setDayPrefs] = React.useState({});
    const [outfitRefresh, setOutfitRefresh] = React.useState(0);
    const [inventoryRefresh, setInventoryRefresh] = React.useState(0);
    const [showWelcome, setShowWelcome] = React.useState(false);
    const inventoryRef = useRef(null);
    const outfitRequestRef = useRef(0);
    const openWardrobe = () => {
        var _a;
        setInventoryRefresh(r => r + 1);
        (_a = inventoryRef.current) === null || _a === void 0 ? void 0 : _a.showModal();
    };
    useEffect(() => { setClassid(user ? 'b2' : ''); }, [user]);
    useEffect(() => {
        if (!user)
            setShowWelcome(false);
    }, [user]);
    useEffect(() => {
        if (!(user === null || user === void 0 ? void 0 : user.sub))
            return;
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
                if (!r.ok)
                    throw new Error(`Outfit request failed (${r.status})`);
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
    const updateDayPrefs = (date, patch) => {
        setDayPrefs(prev => {
            var _a;
            return (Object.assign(Object.assign({}, prev), { [date]: Object.assign(Object.assign({}, ((_a = prev[date]) !== null && _a !== void 0 ? _a : defaultDayPrefs())), patch) }));
        });
    };
    const handleDaySelect = (day, label) => {
        var _a;
        const prefs = (_a = dayPrefs[day.date]) !== null && _a !== void 0 ? _a : defaultDayPrefs();
        setOutfitTarget(tempToTarget(day.maxTemp));
        setSelectedDay(label);
        setSelectedDate(day.date);
        setWeatherCode(day.weatherCode);
        setFormality(prefs.formality);
        setColorPreset(prefs.colorPreset);
    };
    const handleFormalityChange = (value) => {
        setFormality(value);
        if (selectedDate)
            updateDayPrefs(selectedDate, { formality: value });
    };
    const handleColorPresetChange = (value) => {
        setColorPreset(value);
        if (selectedDate)
            updateDayPrefs(selectedDate, { colorPreset: value });
    };
    const handlePredict = (id) => __awaiter(this, void 0, void 0, function* () {
        try {
            const r = yield fetch(apiPath(`/api/predict_image/${id}`));
            const d = yield r.json();
            setPrediction(d.prediction);
        }
        catch (err) {
            console.error(err);
        }
    });
    const handleFileChange = (e) => {
        var _a;
        const file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
        if (!file)
            return;
        setPrediction('Uploading...');
        const formData = new FormData();
        formData.append('image', file);
        formData.append('user_info', JSON.stringify(user));
        fetch(apiPath('/api/uploadnx'), { method: 'POST', body: formData })
            .then(r => r.json())
            .then(d => {
            setImageId(d.image_id);
            setImageUrl(apiPath(`/api/image/${d.image_id}`));
            handlePredict(d.image_id);
            setOutfitRefresh(r => r + 1);
            setInventoryRefresh(r => r + 1);
        })
            .catch(console.error);
    };
    return (_jsx("div", { className: classid, children: user ? (_jsxs(_Fragment, { children: [_jsx("dialog", { ref: inventoryRef, onClick: () => { var _a; return (_a = inventoryRef.current) === null || _a === void 0 ? void 0 : _a.close(); }, children: _jsx(InventoryContent, { user: user, refreshKey: inventoryRefresh, onClose: () => { var _a; return (_a = inventoryRef.current) === null || _a === void 0 ? void 0 : _a.close(); } }) }), showWelcome && (_jsx(WelcomeToast, { name: user.name, onDone: () => setShowWelcome(false) })), _jsxs("div", { className: "dashboard-layout", children: [_jsxs("div", { className: "dashboard-sidebar", children: [_jsx(WeatherWidget, { onDaySelect: handleDaySelect, formality: formality, colorPreset: colorPreset, onFormalityChange: handleFormalityChange, onColorPresetChange: handleColorPresetChange }), _jsx("div", { className: "prediction-box", children: imageUrl ? (_jsxs(_Fragment, { children: [_jsx("img", { src: imageUrl, alt: "Last Uploaded", className: "last-uploaded-img" }), _jsxs("p", { children: ["AI Classifier: ", _jsx("strong", { children: prediction || 'Processing...' })] })] })) : (_jsx("p", { style: { color: '#666', fontSize: '14px' }, children: "Upload an image to see AI classification" })) }), _jsxs("div", { className: "dashboard-controls", children: [_jsx("button", { className: "b1-compact", onClick: () => { var _a; return (_a = document.getElementById('fileInput')) === null || _a === void 0 ? void 0 : _a.click(); }, children: "Add Image" }), _jsx("button", { className: "b1-compact", onClick: openWardrobe, children: "Wardrobe" }), _jsx("button", { className: "b1-compact", onClick: () => { googleLogout(); setUser(null); setClassid(''); }, children: "Logout" })] })] }), _jsx("div", { className: "dashboard-main", children: _jsxs("div", { className: "outfits-container", children: [_jsxs("h3", { children: ["Outfit Suggestions for ", selectedDay, formality === 'formal' ? ' (Formal)' : ''] }), outfits.length > 0 ? (_jsx("div", { className: "outfits-list", children: outfits.map((off, idx) => (_jsxs("div", { className: "outfit-card", children: [_jsxs("h4", { children: ["Option ", idx + 1] }), _jsx("div", { className: "outfit-grid-compact", children: Object.entries(off).map(([part, item]) => item && (_jsxs("div", { className: "outfit-item-compact", children: [_jsx("img", { src: apiPath(`/api/image/${item.id}`), alt: item.label }), _jsxs("span", { className: "outfit-item-label-compact", children: [item.label, item.color && _jsxs("span", { className: "outfit-item-color", children: [" \u00B7 ", item.color] })] })] }, part))) })] }, idx))) })) : (_jsxs("div", { className: "no-outfits", children: [_jsx("p", { children: "Not enough items in your wardrobe to suggest an outfit for this weather." }), _jsx("p", { style: { fontSize: '13px', color: '#888' }, children: "Try adding more Tops, Bottoms, and Shoes!" })] }))] }) })] }), _jsxs("div", { style: { display: 'none', justifyContent: 'center', flexWrap: 'wrap' }, children: [_jsx("button", { className: "b1", onClick: () => { var _a; return (_a = document.getElementById('fileInput')) === null || _a === void 0 ? void 0 : _a.click(); }, children: _jsx("h4", { children: "Add Image" }) }), _jsx("button", { className: "b1", onClick: openWardrobe, children: _jsx("h4", { children: "View Inventory" }) }), _jsx("button", { className: "b1", onClick: () => { googleLogout(); setUser(null); setClassid(''); }, children: _jsx("h4", { children: "Logout" }) })] }), _jsx("input", { id: "fileInput", type: "file", accept: "image/*", onChange: handleFileChange, style: { display: 'none' } })] })) : (_jsx("div", { className: "landing-auth", children: _jsxs("div", { className: "landing-auth__card", children: [_jsx("h2", { className: "landing-auth__title", children: "Sign in to continue" }), _jsx("p", { className: "landing-auth__subtitle", children: "Connect your Google account to start building your smart wardrobe." }), _jsx("div", { className: "landing-auth__button", children: _jsx(GoogleLogin, { onSuccess: credentialResponse => {
                                const decoded = jwtDecode(credentialResponse.credential || '');
                                setUser(decoded);
                                setShowWelcome(true);
                                fetch(apiPath('/api/auth'), {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ id_token: credentialResponse.credential }),
                                });
                            }, onError: () => console.log('Login Failed') }) })] }) })) }));
}
const LANDING_FEATURES = [
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
    const [activeFeature, setActiveFeature] = React.useState(null);
    const toggleFeature = (id) => {
        setActiveFeature(prev => (prev === id ? null : id));
    };
    return (_jsxs("div", { className: "landing", children: [_jsxs("section", { className: "landing-hero", children: [_jsx("p", { className: "landing-hero__eyebrow", children: "Personal wardrobe assistant" }), _jsxs("h1", { className: "landing-hero__title", children: ["Dress smarter.", _jsx("br", {}), _jsx("span", { children: "Every day." })] }), _jsx("p", { className: "landing-hero__subtitle", children: "FabAI reads the forecast, understands your closet, and suggests outfits that fit the weather and your style." })] }), _jsx("section", { className: "landing-features", "aria-label": "Features", children: LANDING_FEATURES.map(feature => {
                    const active = activeFeature === feature.id;
                    return (_jsxs("article", { className: `landing-feature${active ? ' landing-feature--active' : ''}`, onMouseEnter: () => setActiveFeature(feature.id), onMouseLeave: () => setActiveFeature(null), onClick: () => toggleFeature(feature.id), onKeyDown: e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleFeature(feature.id);
                            }
                        }, role: "button", tabIndex: 0, "aria-expanded": active, children: [_jsx("div", { className: "landing-feature__glow", "aria-hidden": "true" }), _jsx("span", { className: "landing-feature__icon", children: feature.icon }), _jsx("h3", { className: "landing-feature__title", children: feature.title }), _jsx("p", { className: "landing-feature__desc", children: feature.desc }), _jsx("p", { className: "landing-feature__detail", children: feature.detail }), 'preview' in feature && feature.preview ? (_jsxs("div", { className: "landing-feature__preview", "aria-hidden": !active, children: [_jsx("img", { src: feature.preview[0], alt: "" }), _jsx("img", { src: feature.preview[1], alt: "" })] })) : null] }, feature.id));
                }) })] }));
}
export function Card(props) {
    const bg = props.bg === true ? { "backgroundImage": `url("${props.img}")` } : { "backgroundImage": "", "backgroundColor": "rgba(0, 0, 0, 0)" };
    const cardFeature = (_jsxs("div", { className: 'cardFeature', style: bg, children: [_jsx("h1", { children: props.title }), _jsx("h2", { children: props.content })] }));
    const cardMain = (_jsxs("div", { className: 'cardMain', style: bg, children: [_jsx("h2", { children: props.title }), _jsx("h3", { children: props.content })] }));
    let active = false;
    const [expanded, setExpanded] = React.useState(false);
    const [contents, setContents] = React.useState({ "display": "none", "opacity": "0", "transition": "2s", "transitionDelay": "4.5s" });
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
    const cardSub = (_jsxs("div", { className: `cardSub${expanded ? ' cardSub--expanded' : ''}`, onClick: () => {
            if (!window.matchMedia('(max-width: 768px)').matches)
                return;
            setExpanded(v => {
                const next = !v;
                if (next) {
                    setContents({ "display": "inline-flex", "opacity": "1", "transition": "2s", "transitionDelay": "0s" });
                    setSubContents1({ "display": "block", "opacity": "1", "transition": "2s" });
                    setSubContents2({ "display": "block", "opacity": "1", "transition": "2s", "transitionDelay": "0s" });
                }
                else {
                    setContents({ "display": "none", "opacity": "0", "transition": "0s", "transitionDelay": "0s" });
                    setSubContents1({ "display": "none", "opacity": "0", "transition": "2s" });
                    setSubContents2({ "display": "none", "opacity": "0", "transition": "2s", "transitionDelay": "0s" });
                }
                return next;
            });
        }, onMouseOver: () => {
            active = true;
            if (active) {
                setTimeout(setSubContents1, 0, { "display": "block", "opacity": "0" });
                setTimeout(setSubContents2, 0, { "display": "block", "opacity": "0" });
                setContents({ "display": "inline-flex", "opacity": "1", "transition": "2s", "transitionDelay": "0.5s" });
                setTimeout(setSubContents1, 1000, { "opacity": "1", "transition": "2s" });
                setTimeout(setSubContents2, 1700, { "opacity": "1", "transition": "2s", "transitionDelay": "0.5s" });
            }
        }, onMouseLeave: () => {
            active = false;
            setTimeout(setSubContents1, 0, { "opacity": "0", "transition": "1s", "transitionDelay": "0s" });
            setTimeout(setSubContents2, 0, { "opacity": "0", "transition": "1s", "transitionDelay": "0s" });
            setTimeout(setContents, 1000, { "opacity": "0", "transition": "0s", "transitionDelay": "0.5s" });
            setTimeout(setSubContents1, 1000, { "display": "none", "opacity": "0" });
            setTimeout(setSubContents2, 1000, { "display": "none", "opacity": "0" });
            setTimeout(setContents, 1000, { "display": "none", "opacity": "0" });
        }, children: [_jsxs("div", { className: "subText", children: [_jsx("h1", { style: { color: "black" }, children: props.title }), _jsx("h3", { children: props.content })] }), _jsxs("div", { className: "subImg", style: contents, children: [_jsx("img", { src: props.img, style: subContents1 }), _jsx("img", { src: props.img2, style: subContents2 })] })] }));
    if (props.display === false)
        return null;
    if (props.type === 'Feature')
        return cardFeature;
    return props.type === 'Main' ? cardMain : cardSub;
}
const navClickHandler = () => {
    window.location.assign('/');
    return 0;
};
export function Navbar() {
    return (_jsxs("div", { className: 'nav', children: [_jsx("h1", { className: "nav__brand", children: "Fab" }), _jsx("img", { className: "nav__logo", src: "/CirculationsLogoNoBg.png", onClick: navClickHandler, alt: "FabAI home" }), _jsx("h1", { className: "nav__brand", children: "AI" })] }));
}

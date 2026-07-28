var _a;
import { jsx as _jsx } from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
import App from "./app";
import './style.css';
import { GoogleOAuthProvider } from '@react-oauth/google';
const googleClientId = (_a = import.meta.env.VITE_GOOGLE_CLIENT_ID) !== null && _a !== void 0 ? _a : '';
const root = createRoot(document.getElementById("root"));
root.render(_jsx(GoogleOAuthProvider, { clientId: googleClientId, children: _jsx(App, {}) }));

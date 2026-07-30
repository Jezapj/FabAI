import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
import './style.css';
import { GoogleOAuthProvider } from '@react-oauth/google';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';

if (!googleClientId && import.meta.env.PROD) {
  console.error(
    'VITE_GOOGLE_CLIENT_ID is missing at build time. Set it on the Railway *web* service and redeploy.'
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(
  googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>
      <App />
    </GoogleOAuthProvider>
  ) : (
    <div style={{ padding: 24, color: '#fff', maxWidth: 480, margin: '40px auto' }}>
      <h1>Google sign-in not configured</h1>
      <p>
        Set <code>VITE_GOOGLE_CLIENT_ID</code> on the Railway web service (same value as
        <code> GOOGLE_CLIENT_ID</code> in Google Cloud), then redeploy.
      </p>
    </div>
  )
);

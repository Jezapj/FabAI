import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
import './style.css';
import { GoogleOAuthProvider } from '@react-oauth/google';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

const root = createRoot(document.getElementById("root")!);
root.render(
  <GoogleOAuthProvider clientId={googleClientId}>
    <App />
  </GoogleOAuthProvider>
);

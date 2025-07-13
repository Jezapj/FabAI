import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
import './style.css'; // relative path to your CSS file
import { GoogleOAuthProvider } from '@react-oauth/google';


const root = createRoot(document.getElementById("root")!);
root.render(
  <GoogleOAuthProvider clientId="120032668636-ck25ilj8ote9pem9q41rum18ke9na1gp.apps.googleusercontent.com">
    <App />
  </GoogleOAuthProvider>
);

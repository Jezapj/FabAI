import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
import './style.css'; // relative path to your CSS file


const root = createRoot(document.getElementById("root")!);
root.render(<App />);

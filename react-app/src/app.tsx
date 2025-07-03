import React from "react";
import { useEffect, useState } from 'react';
import {Main, Navbar} from './Main'



function App() {
  const [message, setMessage] = useState('Loading...');

  useEffect(() => {
    // 🚨 Important: this name must match the Docker Compose/K8s service name
    fetch('http://localhost:5000/')
      .then(res => res.json())
      .then(data => setMessage(data.message))
      .catch(() => setMessage("API call failed"));
  }, []);

  return (
    <>
    <Navbar/>
    <Main/>
    <div>
      <h1>Backtend</h1>
      <p>{message}</p>
    </div>
    </>
  );
}

export default App;

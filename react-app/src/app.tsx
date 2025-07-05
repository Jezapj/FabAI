import React from "react";
import { useEffect, useState, useContext } from 'react';
import {Card, Main, Navbar} from './Main'



function App() {
  const [message, setMessage] = useState('Loading...');

  useEffect(() => {
    // 🚨 Important: this name must match the Docker Compose/K8s service name
    fetch('http://localhost:5000/')
      .then(res => res.json())
      .then(data => setMessage(data.message))
      .catch(() => setMessage("API call failed"));
  }, [message]);

  const handleClick = () => {
    window.location.assign("http://localhost:5000/login")
    fetch('http://localhost:5000/logged_in')
      .then(res2 => res2.json())
      .then(data2 => setMessage(data2.message + data2.userName))
      .catch(() => setMessage("Login failed"));
  }
  return (
    <>
    <Navbar/>
    <Main/>
    <Card title="Backend" content={message} type="Sub"/>
    <div className="button">
        <button onClick={handleClick}> Login</button>
    </div>
    
    </>
  );
}

export default App;

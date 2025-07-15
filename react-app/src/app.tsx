import React from "react";
import { useEffect, useState, useContext } from 'react';
import {Card, Main, Navbar, Login} from './Main'



function App() {
  const [message, setMessage] = useState('Loading...');
  const [b1, setB1] = useState(<div className="b1"><Login/></div>);
  

  useEffect(() => {
    // 🚨 Important: this name must match the Docker Compose/K8s service name
    fetch('http://localhost:5000/')
      .then(res => res.json())
      .then(data => setMessage(data.message))
      .catch(() => setMessage("API call failed"));
  }, [message]);

  useEffect(() => {
    const b2 = <div className="b1" style={{"display":"block"}}><Login/></div>
    setB1(b1)

  }, [b1])

  const handleClick = () => {
    window.location.assign("http://localhost:5000/login")
    fetch('http://localhost:5000/logged_in')
      .then(res2 => res2.json())
      .then(data2 => setMessage(data2.message + data2.userName))
      .catch(() => setMessage("Login failed"));
  }
  const feet = {"height": "40px", "backgroundColor": "rgba(0,0,0, 0.85)"};
  return (
    <>
    <Navbar/>
    <Main/>
    {/*<Card title="Backend" content={message} type="Main"  img=""/>*/}
    {b1}
    
    <div style={feet}></div>
    
    </>
  );
}

export default App;

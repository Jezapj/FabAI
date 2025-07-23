import React from "react";
import { useEffect, useState, useContext } from 'react';
import {Card, Main, Navbar, Login} from './Main'

// 🚨 Important: this name must match the Docker Compose/K8s service name
  //   fetch('http://localhost:5000/')

function App() {
  const [dynLogin, setDynLogin] = useState(<div className="b1"><Login/></div>);

  useEffect(() => {
    const b2 = <div className="b1" style={{"display":"block"}}><Login/></div>
    setDynLogin(dynLogin)

  }, [dynLogin])

  const footer = {"height": "40px", "backgroundColor": "rgba(0,0,0, 0.85)"};
  return (
    <>
    <Navbar/>
    <Main/>
    {dynLogin}
    <div style={footer}></div>
    </>
  );
}

export default App;

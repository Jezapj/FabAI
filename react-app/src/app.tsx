import React from "react";
import { useEffect, useState, useContext } from 'react';
import {Card, Main, Navbar, Login} from './Main'

// 🚨 Important: this name must match the Docker Compose/K8s service name
  //   fetch('http://localhost:5000/')

function App() {
  const [dynLogin, setDynLogin] = useState(<div className="b1"><Login/></div>);
  const [dynMain, setDynMain] = useState(<div><Main/></div>);

  useEffect(() => {
    const b2 = <div className="b1" style={{"display":"none"}}><Login/></div>
    //setDynLogin(b2)
    setDynMain(<div><Main/></div>)

  }, [dynMain])

  const footer = {"height": "40px", "backgroundColor": "rgba(0,0,0, 0.85)"};
  return (
    <>
    <Navbar/>
    {dynMain}
    {dynLogin}
    <div style={footer}></div>
    </>
  );
}

export default App;

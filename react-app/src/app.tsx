import React from "react";
import { useEffect, useState } from 'react';
import { Main, Navbar, Login } from './Main'

function App() {
  const [user, setUser] = useState<any>(null);

  const footer = { "height": "40px", "backgroundColor": "rgba(0,0,0, 0.85)" };
  return (
    <>
      <Navbar />
      {!user && <Main />}
      <div className="b1">
        <Login user={user} setUser={setUser} />
      </div>
      <div style={footer}></div>
    </>
  );
}

export default App;

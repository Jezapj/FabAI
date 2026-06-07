import React from "react";
import { useEffect, useState } from 'react';
import { Main, Navbar, Login } from './Main'

function App() {
  const [user, setUser] = useState<any>(null);

  const footer = { "height": "40px", "backgroundColor": "rgba(0,0,0, 0.85)", "flexShrink": 0 };
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Navbar />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {!user && <Main />}
        <div className="b1" style={{ flex: user ? 1 : 'unset', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Login user={user} setUser={setUser} />
        </div>
      </div>
      <div style={footer}></div>
    </div>
  );
}

export default App;

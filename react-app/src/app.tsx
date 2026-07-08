import React from "react";
import { useEffect, useState } from 'react';
import { Main, Navbar, Login } from './Main'

function App() {
  const [user, setUser] = useState<any>(null);

  const footer = { height: "40px" };
  return (
    <div className={`app-shell${user ? ' app-shell--dashboard' : ''}`}>
      <Navbar />
      {!user && <Main />}
      <div className={user ? 'app-content' : 'b1'}>
        <Login user={user} setUser={setUser} />
      </div>
      <div className="app-footer" style={footer}></div>
    </div>
  );
}

export default App;

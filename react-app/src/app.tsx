import React from "react";
import { useState } from 'react';
import { Main, Navbar, Login } from './Main';
import { InstallPrompt } from './InstallPrompt';

function App() {
  const [user, setUser] = useState<any>(null);

  const footer = { height: "40px" };
  return (
    <div className={`app-shell${user ? ' app-shell--dashboard' : ''}`}>
      <Navbar />
      {!user && <Main />}
      <div className={user ? 'app-content' : 'landing-shell'}>
        <Login user={user} setUser={setUser} />
      </div>
      <div className="app-footer" style={footer}></div>
      <InstallPrompt />
    </div>
  );
}

export default App;

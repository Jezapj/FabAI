import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Main, Navbar, Login } from './Main';
function App() {
    const [user, setUser] = useState(null);
    const footer = { height: "40px" };
    return (_jsxs("div", { className: `app-shell${user ? ' app-shell--dashboard' : ''}`, children: [_jsx(Navbar, {}), !user && _jsx(Main, {}), _jsx("div", { className: user ? 'app-content' : 'b1', children: _jsx(Login, { user: user, setUser: setUser }) }), _jsx("div", { className: "app-footer", style: footer })] }));
}
export default App;

import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Main, Navbar, Login } from './Main';
function App() {
    const [user, setUser] = useState(null);
    const footer = { "height": "40px", "backgroundColor": "rgba(0,0,0, 0.85)" };
    return (_jsxs(_Fragment, { children: [_jsx(Navbar, {}), !user && _jsx(Main, {}), _jsx("div", { className: "b1", children: _jsx(Login, { user: user, setUser: setUser }) }), _jsx("div", { style: footer })] }));
}
export default App;

import { useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import Header from './components/Header.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'

function App() {
    const [user, setUser] = useState(null)
    const navigate = useNavigate()

    function handleLogout() {
        setUser(null)
        navigate('/', { replace: true })
    }

    return (
        <>
            <Header user={user} onLogout={handleLogout} />

            <Routes>
                <Route path="/" element={<Home />} />

                <Route
                    path="/login"
                    element={<Login onLogin={setUser} />}
                />

                <Route path="/signup" element={<Signup />} />
            </Routes>
        </>
    )
}

export default App
import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import DomainView from './pages/DomainView'

function App() {
    const [activeTab, setActiveTab] = useState('articles')

    return (
        <div className="app-layout">
            <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
            <main className="main-content">
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/domain/:id" element={<DomainView activeTab={activeTab} setActiveTab={setActiveTab} />} />
                </Routes>
            </main>
        </div>
    )
}

export default App

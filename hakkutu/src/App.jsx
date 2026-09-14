import { Routes, Route, useNavigate } from 'react-router-dom'
import Home from './pages/Home'
import CameraPage from './pages/CameraPage'

function App() {
  const navigate = useNavigate()

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/CameraPage"
        element={<CameraPage onBack={() => navigate('/')} />}
      />
    </Routes>
  )
}

export default App

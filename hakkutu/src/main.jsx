import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Capture from './pages/CameraPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/CameraPage" element={<CameraPage />} />
    </Routes>
  )
}

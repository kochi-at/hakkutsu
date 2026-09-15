import { Routes, Route, useNavigate } from 'react-router-dom'
import Home from './pages/Home'
import CameraPage from './pages/CameraPage'
import ResultPage from './pages/ResultPage'
import CollectionPage from './pages/CollectionPage'

function App() {
  const navigate = useNavigate()

  return (
    <Routes>
      <Route path="/result" element={<ResultPage />} />
      <Route path="/collection" element={<CollectionPage />} />
      <Route path="/" element={<Home />} />
      <Route
        path="/CameraPage"
        element={<CameraPage onBack={() => navigate('/')} />}
      />
    </Routes>
  )
}

export default App

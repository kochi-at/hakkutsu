import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ScrollOpening from '../components/ScrollOpening'
import './Home.css'

const OPENING_SESSION_KEY = 'hakkutsu-home-opening-played'

function Home() {
  const navigate = useNavigate()
  const [showOpening, setShowOpening] = useState(() => {
    try {
      return !sessionStorage.getItem(OPENING_SESSION_KEY)
    } catch {
      return false
    }
  })

  const handleOpeningDone = () => {
    setShowOpening(false)
    try {
      sessionStorage.setItem(OPENING_SESSION_KEY, '1')
    } catch {
      // sessionStorageが使えない環境では毎回演出が流れるだけなので無視する
    }
  }

  return (
    <div className="home">
      {showOpening && <ScrollOpening onDone={handleOpeningDone} />}
      <p className="home-eyebrow">遺物鑑定所</p>
      <h1>聖遺物鑑定</h1>
      <p className="home-lead">写真を撮って、そこに眠る聖遺物の伝説を鑑定しましょう。</p>
      <div className="home-actions">
        <button type="button" className="capture-button" onClick={() => navigate('/CameraPage')}>
          <svg className="capture-button-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 8h3l1.7-2.2a1 1 0 0 1 .8-.4h5a1 1 0 0 1 .8.4L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
            <circle cx="12" cy="13.3" r="3.4" />
          </svg>
          撮影
        </button>
        <button type="button" className="collection-button" onClick={() => navigate('/collection')}>
          図鑑を見る
        </button>
      </div>
    </div>
  )
}

export default Home

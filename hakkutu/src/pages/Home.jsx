import { useNavigate } from 'react-router-dom'
import './Home.css'

function Home() {
  const navigate = useNavigate()

  return (
    <div className="home">
      <p className="home-eyebrow">遺物鑑定所</p>
      <h1>聖遺物鑑定</h1>
      <p className="home-lead">写真を撮って、そこに眠る聖遺物の伝説を鑑定しましょう。</p>
      <button type="button" className="capture-button" onClick={() => navigate('/CameraPage')}>
        撮影
      </button>
    </div>
  )
}

export default Home

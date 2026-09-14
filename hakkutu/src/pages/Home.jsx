function Home() {
  return (
    <div className="home">
      <h1>いい感じの文章</h1>
      <button type="button" className="capture-button" onClick={() => navigate('/CameraPage')}>
        撮影
      </button>
    </div>
  )
}

export default Home

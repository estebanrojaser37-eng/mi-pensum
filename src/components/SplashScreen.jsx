export default function SplashScreen() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <img src="/icon-512.png" alt="Seminario Bíblico Fares" style={{ width: 160, height: 160 }} />
      <p style={{ marginTop: 16, color: '#1B4F72', fontFamily: 'sans-serif', fontSize: 14 }}>
        Cargando...
      </p>
    </div>
  )
}

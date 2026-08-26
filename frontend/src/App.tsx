import { BrowserRouter, Route, Routes } from 'react-router'
import { HomePage } from './app/HomePage'
import { ProtectedRoute } from './app/ProtectedRoute'
import { SessionBootstrap } from './app/SessionBootstrap'
import { LoginPage } from './features/auth/LoginPage'

function App() {
  return (
    <BrowserRouter>
      <SessionBootstrap>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </SessionBootstrap>
    </BrowserRouter>
  )
}

export default App

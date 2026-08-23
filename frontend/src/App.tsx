import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './contexts/AuthContext'
import { ChatProvider } from './contexts/ChatContext'
import { ConversationProvider } from './contexts/ConversationContext'
import { DocumentProvider } from './contexts/DocumentContext'
import { TaskProvider } from './contexts/TaskContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { UIProvider } from './contexts/UIContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import HomePage from './pages/HomePage'
import ChatPage from './pages/ChatPage'
import DocumentsPage from './pages/DocumentsPage'
import ComparePage from './pages/ComparePage'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'
import MemoryPage from './pages/MemoryPage'
import { useTheme } from './hooks/useTheme'


function ThemedToaster() {
  const { theme } = useTheme()
  return (
    <Toaster
      position="bottom-right"
      theme={theme}
      toastOptions={{
        style: theme === 'dark' ? {
          background: '#171A21',
          border: '1px solid #292E38',
          color: '#F1F3F7',
          borderRadius: '6px',
          fontSize: '12px',
          fontFamily: 'Inter, sans-serif',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        } : {
          background: '#FFFFFF',
          border: '1px solid #D8E2EE',
          color: '#0F172A',
          borderRadius: '6px',
          fontSize: '12px',
          fontFamily: 'Inter, sans-serif',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
        },
      }}
    />
  )
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <UIProvider>
            <TaskProvider>
              <ConversationProvider>
                <DocumentProvider>
                  <ChatProvider>
                    <Routes>
                      {/* Public Landing Page */}
                      <Route path="/home" element={<HomePage />} />

                      {/* Protected AI Chat Assistant */}
                      <Route
                        path="/"
                        element={
                          <ProtectedRoute>
                            <ChatPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/:conversationId?"
                        element={
                          <ProtectedRoute>
                            <ChatPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/chat"
                        element={
                          <ProtectedRoute>
                            <ChatPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/chat/:conversationId?"
                        element={
                          <ProtectedRoute>
                            <ChatPage />
                          </ProtectedRoute>
                        }
                      />

                      {/* Protected Document Label Management */}
                      <Route
                        path="/documents"
                        element={
                          <ProtectedRoute>
                            <DocumentsPage />
                          </ProtectedRoute>
                        }
                      />

                      {/* Protected Drug Comparison */}
                      <Route
                        path="/compare"
                        element={
                          <ProtectedRoute>
                            <ComparePage />
                          </ProtectedRoute>
                        }
                      />

                      {/* Protected AI Memory personalization */}
                      <Route
                        path="/memories"
                        element={
                          <ProtectedRoute>
                            <MemoryPage />
                          </ProtectedRoute>
                        }
                      />

                      {/* Auth Routes */}
                      <Route path="/signin" element={<SignInPage />} />
                      <Route path="/login" element={<SignInPage />} />
                      <Route path="/signup" element={<SignUpPage />} />
                      <Route path="/register" element={<SignUpPage />} />

                      {/* Fallback */}
                      <Route path="*" element={<HomePage />} />
                    </Routes>

                  <ThemedToaster />
                </ChatProvider>
              </DocumentProvider>
            </ConversationProvider>
          </TaskProvider>
        </UIProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}


export default App


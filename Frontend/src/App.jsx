// src/App.jsx
import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import ChatWindow from "./ChatWindow.jsx";
import { MyContext } from "./MyContext.jsx";
import { v1 as uuidv1 } from "uuid";

import { AuthProvider, AuthContext } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./components/Login";
import Signup from "./components/Signup";

import HomePage from "./components/HomePage.jsx"; // your public landing page

function AppLayout({ mobileSidebarOpen, setMobileSidebarOpen, providerValues }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 text-gray-800">
      <MyContext.Provider value={providerValues}>
        <div className="max-w-[1400px] mx-auto h-screen grid grid-cols-1 lg:grid-cols-[320px_1fr]">
          <aside className="hidden lg:block h-full overflow-auto border-r border-blue-200 shadow-xl bg-white">
            <Sidebar />
          </aside>

          <MobileHeader setNewChat={providerValues.setNewChat} toggleMobileSidebar={() => setMobileSidebarOpen(s => !s)} />

          {mobileSidebarOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex">
              <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setMobileSidebarOpen(false)} aria-hidden="true"></div>

              <div className="relative w-80 max-w-[80%] h-full bg-white shadow-xl border-r border-blue-200 overflow-auto">
                <div className="p-3 flex items-center justify-between border-b border-blue-100">
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-600 w-9 h-9 rounded flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </div>
                    <span className="font-semibold text-blue-800">Menu</span>
                  </div>
                  <button onClick={() => setMobileSidebarOpen(false)} className="p-2 rounded hover:bg-gray-100">
                    <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="p-3">
                  <Sidebar />
                </div>
              </div>
            </div>
          )}

          <main className="flex flex-col h-screen overflow-hidden bg-white">
            <ChatWindow />
          </main>
        </div>
      </MyContext.Provider>
    </div>
  );
}

function MobileHeader({ setNewChat, toggleMobileSidebar }) {
  return (
    <header className="lg:hidden bg-white border-b border-blue-200 shadow-sm">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 w-10 h-10 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-blue-800">PharmaAssist</h1>
            <p className="text-xs text-blue-600">Medical Research AI</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setNewChat(true)}
            className="hidden sm:inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm transition"
            aria-label="New Query"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Query
          </button>

          <button onClick={toggleMobileSidebar} className="bg-blue-100 hover:bg-blue-200 p-2 rounded-lg transition-colors" aria-label="Open menu">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

/**
 * Redirects authenticated users away from auth pages like /login and /signup
 * If logged-in -> send to /app
 */
function PublicAuthRoute({ children }) {
  const { user, loading } = React.useContext(AuthContext);
  const loc = useLocation();

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (user) return <Navigate to="/app" replace state={{ from: loc }} />;
  return children;
}

function App() {
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState(null);
  const [currThreadId, setCurrThreadId] = useState(uuidv1());
  const [prevChats, setPrevChats] = useState([]);
  const [newChat, setNewChat] = useState(true);
  const [allThreads, setAllThreads] = useState([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const providerValues = {
    prompt,
    setPrompt,
    reply,
    setReply,
    currThreadId,
    setCurrThreadId,
    newChat,
    setNewChat,
    prevChats,
    setPrevChats,
    allThreads,
    setAllThreads
  };

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public landing page */}
          <Route path="/" element={<HomePage />} />

          {/* Public auth pages (if logged in -> redirected to /app) */}
          <Route path="/login" element={<PublicAuthRoute><Login /></PublicAuthRoute>} />
          <Route path="/signup" element={<PublicAuthRoute><Signup /></PublicAuthRoute>} />

          {/* Protected main app lives at /app */}
          <Route path="/app" element={
            <ProtectedRoute>
              <AppLayout
                mobileSidebarOpen={mobileSidebarOpen}
                setMobileSidebarOpen={setMobileSidebarOpen}
                providerValues={providerValues}
              />
            </ProtectedRoute>
          } />

          {/* Optional preview route for Home (duplicates /) */}
          <Route path="/home-preview" element={<HomePage />} />

          {/* fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

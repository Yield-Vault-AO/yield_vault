import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Header from "./components/landing/Header";
import HomePage from "./components/landing/HomePage";
import Dashboard from "./components/Dashboard";
import Strategy from "./components/Strategy";
import Agent from "./components/Agent";
import CreateStrategy from "./components/CreateStrategy";
import YaoChatbot from "./components/chatbot/YaoChatbot";
import { PoolProvider } from "./contexts/PoolContext";

function App() {
  return (
    <PoolProvider>
      <Router>
        <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0F1419] relative overflow-hidden transition-colors duration-300">
          {/* Static Header */}
          <Header />

          {/* Main Content */}
          <main className="pt-20 md:pt-24">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboard/create" element={<CreateStrategy />} />
              <Route path="/strategy/:id" element={<Strategy />} />
              <Route path="/agent/:id" element={<Agent />} />
            </Routes>
          </main>

          <YaoChatbot />

          {/* Global Toast Notifications */}
          <Toaster
            toastOptions={{
              className:
                "dark:bg-[#1A2228] dark:text-[#EAEAEA] dark:border-[#192127]",
              duration: 5000,
              style: {
                background: "#F8F7F4",
                color: "#1A2228",
                border: "1px solid #EAEAEA",
              },
            }}
          />
        </div>
      </Router>
    </PoolProvider>
  );
}

export default App;

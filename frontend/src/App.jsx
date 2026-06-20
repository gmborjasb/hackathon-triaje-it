import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Toaster } from '@/components/ui/toaster';
import { Home } from '@/pages/Home';
import { TicketDetail } from '@/pages/TicketDetail';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-transparent relative selection:bg-primary/30">
        {/* Background glow effects */}
        <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="fixed bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
        
        <Header />

        <main className="container mx-auto px-4 py-8 relative z-10">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/ticket/:id" element={<TicketDetail />} />
          </Routes>
        </main>

        <Toaster />
      </div>
    </Router>
  );
}

export default App;

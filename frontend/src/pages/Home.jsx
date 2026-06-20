import React, { useState, useEffect } from 'react';
import { Uploader } from '@/components/Uploader';
import { Dashboard } from '@/components/Dashboard';
import { useToast } from '@/hooks/use-toast';
import { generateMockTickets } from '@/lib/mockData';
import { ChatbotGlobal } from '@/components/ChatbotGlobal';
import { TicketDetailModal } from '@/components/TicketDetailModal';
import { MessageSquareCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export function Home() {
  const [tickets, setTickets] = useState([]);
  const [isProcessingStarted, setIsProcessingStarted] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  
  // Estados del Chatbot: 'hidden', 'panel', 'fullscreen'
  const [chatState, setChatState] = useState('hidden');
  const [chatContextTicket, setChatContextTicket] = useState(null);

  const { toast } = useToast();

  const API_READ = import.meta.env.VITE_API_URL_READ;
  const API_WRITE = import.meta.env.VITE_API_URL_WRITE;

  const handleUpload = async (parsedTickets) => {
    if (!parsedTickets || parsedTickets.length === 0) return;
    
    // 1. Mostrar inmediatamente en la UI para feedback visual rápido
    const initTickets = parsedTickets.map(t => ({...t, estado: 'PENDIENTE'}));
    setTickets(initTickets);
    setIsProcessingStarted(true);
    setChatState('panel');
    
    try {
      // 2. Enviar los tickets reales a OCI / AWS
      const res = await fetch(API_WRITE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedTickets)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast({
          title: "Tickets despachados",
          description: `Se enviaron ${data.procesados || data.total_procesados || parsedTickets.length} tickets a la IA para análisis.`,
        });
      } else {
        throw new Error(data.error || "Error al despachar");
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Demora en conexión",
        description: "El servidor tardó en responder o hubo un error: " + err.message,
      });
      // No detenemos el polling porque tal vez sí llegaron a la cola pero el gateway dio timeout
    }
  };

  // Polling Real a DynamoDB
  useEffect(() => {
    if (!isProcessingStarted) return;

    const timer = setInterval(async () => {
      try {
        const res = await fetch(API_READ);
        if (!res.ok) return;
        const dbTickets = await res.json();
        
        if (dbTickets && Array.isArray(dbTickets)) {
          setTickets(currentTickets => {
            // Combinar tickets locales con los de DB. La DB tiene prioridad.
            const merged = currentTickets.map(t => {
              const fromDb = dbTickets.find(db => db.ticket_id === t.ticket_id);
              return fromDb || t;
            });
            // Si la DB tiene tickets que no estaban en current, los añadimos
            const news = dbTickets.filter(db => !currentTickets.find(t => t.ticket_id === db.ticket_id));
            return [...merged, ...news];
          });
          
          // Revisar si ya todos están RESUELTOS
          const pendientes = dbTickets.filter(t => t.estado !== 'RESUELTO');
          if (dbTickets.length > 0 && pendientes.length === 0) {
            toast({ title: "Análisis Completado", description: "Todos los tickets fueron procesados por AWS/Groq." });
            setIsProcessingStarted(false);
            clearInterval(timer);
          }
        }
      } catch (err) {
        console.error("Error polling:", err);
      }
    }, 3000); // Polling cada 3 segundos a DynamoDB

    return () => clearInterval(timer);
  }, [isProcessingStarted, toast]);

  const handleTicketClick = (ticket) => {
    if (ticket.estado === 'RESUELTO') {
      setSelectedTicket(ticket);
      setChatContextTicket(ticket);
    } else {
      toast({ title: "Ticket en proceso", description: "Espera a que termine de ser analizado." });
    }
  };

  return (
    <div className="relative flex gap-6 min-h-[calc(100vh-8rem)]">
      
      {/* Contenido Principal (Dashboard) */}
      <motion.div 
        layout
        className={`flex-1 space-y-8 ${chatState === 'fullscreen' ? 'hidden' : 'block'}`}
      >
        {tickets.length === 0 ? (
          <div className="max-w-2xl mx-auto mt-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Uploader onUpload={handleUpload} />
          </div>
        ) : (
          <div className="animate-in fade-in duration-700">
            <Dashboard tickets={tickets} onTicketClick={handleTicketClick} />
          </div>
        )}
      </motion.div>

      {/* Chatbot (Panel Lateral o Pantalla Completa) */}
      <AnimatePresence>
        {chatState !== 'hidden' && (
          <motion.div
            initial={{ opacity: 0, x: 50, width: 0 }}
            animate={{ 
              opacity: 1, 
              x: 0, 
              width: chatState === 'fullscreen' ? '100%' : '400px'
            }}
            exit={{ opacity: 0, x: 50, width: 0 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            className={`shrink-0 z-20 ${chatState === 'fullscreen' ? 'absolute inset-0 bg-background' : 'relative'}`}
          >
            <ChatbotGlobal 
              contextTicket={chatContextTicket}
              setContextTicket={setChatContextTicket}
              isFullScreen={chatState === 'fullscreen'}
              onToggleFullscreen={() => setChatState(s => s === 'fullscreen' ? 'panel' : 'fullscreen')}
              onClose={() => setChatState('hidden')}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB (Floating Action Button) para abrir chat cuando está oculto */}
      <AnimatePresence>
        {chatState === 'hidden' && tickets.length > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button 
              size="icon" 
              className="h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => setChatState('panel')}
            >
              <MessageSquareCode className="h-6 w-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Detalle (Se superpone a todo si está abierto, excepto al chat fullscreen) */}
      <TicketDetailModal 
        ticket={selectedTicket} 
        isOpen={!!selectedTicket} 
        onClose={() => setSelectedTicket(null)} 
      />

    </div>
  );
}

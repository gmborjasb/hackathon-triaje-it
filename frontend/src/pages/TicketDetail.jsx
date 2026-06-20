import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, Info, MessageSquareCode, ShieldAlert } from 'lucide-react';
import { ChatbotRAG } from '@/components/ChatbotRAG';
import { generateMockTickets } from '@/lib/mockData';

export function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);

  useEffect(() => {
    // Simulamos un fetch a la API para obtener el detalle del ticket
    const allMockTickets = generateMockTickets();
    const found = allMockTickets.find(t => t.ticket_id === id);
    if (found) {
      setTicket({ ...found, estado: 'RESUELTO' });
    }
  }, [id]);

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/50">
        <p>Cargando detalles del ticket...</p>
      </div>
    );
  }

  const urgenciaConfig = {
    'ALTA': 'bg-red-500/20 text-red-300 border-red-500/30',
    'MEDIA': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    'BAJA': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  };
  const urgColor = urgenciaConfig[ticket.urgencia?.toUpperCase()] || 'bg-white/10 text-white/70';

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Button 
        variant="ghost" 
        onClick={() => navigate('/')} 
        className="mb-6 text-muted-foreground hover:text-white hover:bg-white/5"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver al Dashboard
      </Button>

      <div className="bg-black/40 border border-white/10 backdrop-blur-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col lg:flex-row min-h-[600px]">
        
        {/* Panel Izquierdo: Detalles del Ticket */}
        <div className="flex-1 border-b lg:border-b-0 lg:border-r border-white/5 flex flex-col">
          <div className="p-8 pb-6 border-b border-white/5 bg-white/[0.02]">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
                  <span className="font-mono text-muted-foreground opacity-50 text-2xl">#{ticket.ticket_id}</span>
                  {ticket.tema || "Análisis Generado"}
                </h1>
                <p className="text-white/60">Diagnosticado y clasificado por el motor de IA Groq/Llama 3</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className={urgColor + " text-sm py-1 px-3"}>
                  Urgencia: {ticket.urgencia}
                </Badge>
                <Badge variant="outline" className="bg-blue-500/10 text-blue-300 border-blue-500/20 text-sm py-1 px-3">
                  {ticket.departamento}
                </Badge>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-8 flex-1">
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3 uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                Problema Principal
              </h3>
              <div className="bg-white/5 border border-white/10 rounded-lg p-5 text-lg text-white/90 leading-relaxed">
                {ticket.problema_principal}
              </div>
            </section>

            {ticket.problemas_asociados && ticket.problemas_asociados.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  Problemas Asociados
                </h3>
                <div className="flex flex-wrap gap-2">
                  {ticket.problemas_asociados.map((prob, i) => (
                    <Badge key={i} variant="secondary" className="bg-white/10 hover:bg-white/20 text-sm py-1">
                      {prob}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            <Separator className="bg-white/5" />

            <section>
              <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2 mb-3 uppercase tracking-wider">
                <CheckCircle2 className="w-5 h-5" />
                Solución Propuesta (Nivel 1)
              </h3>
              <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-6">
                <div className="prose prose-invert max-w-none text-emerald-100/90 whitespace-pre-wrap text-lg leading-relaxed">
                  {ticket.propuesta_solucion}
                </div>
              </div>
            </section>

            {ticket.solucion_secundaria && (
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3 uppercase tracking-wider">
                  <Info className="w-4 h-4" />
                  Plan B / Solución Secundaria
                </h3>
                <div className="bg-white/5 border border-white/10 rounded-lg p-5 text-white/70 italic">
                  {ticket.solucion_secundaria}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Panel Derecho: Chatbot RAG */}
        <div className="w-full lg:w-[450px] shrink-0 bg-black/60 flex flex-col p-6">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-2 mb-4 uppercase tracking-wider">
            <MessageSquareCode className="w-4 h-4" />
            Asistente RAG Histórico
          </h3>
          <div className="flex-1">
            <ChatbotRAG ticket={ticket} />
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center opacity-50">
            Conectado a la base de conocimiento vectorial de Pinecone.
          </p>
        </div>
        
      </div>
    </div>
  );
}

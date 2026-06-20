import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Bot, User, Loader2, Maximize2, Minimize2, X, Globe, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateRAGResponse } from '@/lib/mockData';

export function ChatbotGlobal({ contextTicket, setContextTicket, isFullScreen, onToggleFullscreen, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hola, soy el asistente RAG global. Puedes hacerme preguntas sobre toda la base de conocimientos, o seleccionar un ticket específico del Dashboard para contextualizar la búsqueda.` }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Efecto cuando el contexto cambia
  useEffect(() => {
    if (contextTicket) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `*Contexto cambiado a **#${contextTicket.ticket_id}**.* ¿Qué necesitas saber sobre este caso?` 
      }]);
    } else {
      // Solo avisar si cambiamos de un ticket a global
      if (messages.length > 1) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `*Contexto cambiado a **Global**.* Ahora buscaré en todo el historial.` 
        }]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextTicket]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(import.meta.env.VITE_API_URL_CHATBOT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMessage.content,
          contextTicket: contextTicket
        })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Lo siento, ocurrió un error al consultar el RAG.' }]);
      console.error("Error RAG:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex flex-col border border-white/10 overflow-hidden bg-black/60 backdrop-blur-2xl shadow-2xl transition-all duration-300 ${isFullScreen ? 'h-full rounded-none' : 'h-[calc(100vh-10rem)] rounded-2xl'}`}>
      
      {/* Cabecera del Chat */}
      <div className="bg-white/5 p-4 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-primary">
            <Bot className="w-5 h-5" />
            <span className="font-bold tracking-wide">Asistente RAG</span>
          </div>
          
          {/* Selector de Contexto */}
          <div className="flex items-center gap-2 mt-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className={`h-7 text-xs px-2 rounded-md ${!contextTicket ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-white'}`}
              onClick={() => setContextTicket(null)}
            >
              <Globe className="w-3 h-3 mr-1" /> Global
            </Button>
            {contextTicket && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs px-2 rounded-md bg-blue-500/20 text-blue-400"
              >
                <Hash className="w-3 h-3 mr-1" /> {contextTicket.ticket_id}
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50 hover:text-white" onClick={onToggleFullscreen}>
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50 hover:text-red-400 hover:bg-red-500/10" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Area de Mensajes */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 pb-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`p-2 rounded-full h-8 w-8 flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-500/20 text-blue-400' : 'bg-primary/20 text-primary'}`}>
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${msg.role === 'user' ? 'bg-blue-600/30 text-white rounded-tr-none' : 'bg-white/5 border border-white/5 text-white/90 rounded-tl-none'}`}>
                <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="p-2 rounded-full h-8 w-8 flex items-center justify-center shrink-0 bg-primary/20 text-primary">
                <Bot className="w-4 h-4" />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/5 rounded-tl-none flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Consultando Pinecone...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input de Mensaje */}
      <div className="p-4 border-t border-white/5 bg-black/20 shrink-0">
        <div className="relative flex items-center">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={contextTicket ? `Pregunta sobre el ${contextTicket.ticket_id}...` : "Pregunta al historial completo..."}
            className="bg-white/5 border-white/10 focus-visible:ring-primary/50 pr-12 h-12 rounded-xl"
            disabled={isLoading}
          />
          <Button 
            size="icon"
            onClick={handleSend} 
            disabled={!input.trim() || isLoading} 
            className="absolute right-1 h-10 w-10 rounded-lg bg-primary/80 hover:bg-primary"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

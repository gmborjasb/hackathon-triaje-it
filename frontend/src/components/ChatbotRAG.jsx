import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateRAGResponse } from '@/lib/mockData';

export function ChatbotRAG({ ticket }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hola, soy el asistente experto. ¿Tienes alguna duda técnica sobre el ticket **${ticket.ticket_id}** o quieres buscar incidentes similares en la base de conocimientos?` }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simular retraso de la API RAG (Pinecone + Groq)
    setTimeout(() => {
      const responseContent = generateRAGResponse(userMessage.content, ticket);
      setMessages(prev => [...prev, { role: 'assistant', content: responseContent }]);
      setIsLoading(false);
    }, 2000);
  };

  return (
    <div className="flex flex-col h-[500px] border border-white/10 rounded-xl overflow-hidden bg-black/40 backdrop-blur-md">
      <div className="bg-primary/10 p-3 border-b border-white/10 flex items-center gap-2">
        <Bot className="w-5 h-5 text-primary" />
        <span className="font-semibold text-sm">Consultor RAG Experto</span>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
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
                <Loader2 className="w-4 h-4 animate-spin" /> Buscando en la base vectorial...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-white/10 bg-black/20 flex gap-2">
        <Input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Escribe tu duda al experto..."
          className="bg-white/5 border-white/10 focus-visible:ring-primary/50"
          disabled={isLoading}
        />
        <Button onClick={handleSend} disabled={!input.trim() || isLoading} className="shrink-0 bg-primary/80 hover:bg-primary">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, Info, ShieldAlert } from 'lucide-react';

export function TicketDetailModal({ ticket, isOpen, onClose }) {
  if (!ticket) return null;

  const urgenciaConfig = {
    'ALTA': 'bg-red-500/20 text-red-300 border-red-500/30',
    'MEDIA': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    'BAJA': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  };
  const urgColor = urgenciaConfig[ticket.urgencia?.toUpperCase()] || 'bg-white/10 text-white/70';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl bg-black/90 border-white/10 backdrop-blur-2xl p-0 flex flex-col shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-white/5 bg-white/[0.02]">
          <div className="flex justify-between items-start gap-4">
            <div>
              <DialogTitle className="text-2xl font-bold flex items-center gap-3 mb-1">
                <span className="font-mono text-muted-foreground opacity-50 text-xl">#{ticket.ticket_id}</span>
                {ticket.tema || "Análisis Generado"}
              </DialogTitle>
              <DialogDescription className="text-white/70">
                Diagnosticado y clasificado por el motor de IA
              </DialogDescription>
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
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[70vh]">
          <div className="p-6 space-y-8">
            <section>
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-3 uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                Problema Principal
              </h3>
              <div className="bg-white/5 border border-white/10 rounded-lg p-5 text-lg text-white/90">
                {ticket.problema_principal || ticket.texto_original || "Sin detalles."}
              </div>
            </section>

            {ticket.problemas_asociados && ticket.problemas_asociados.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  Problemas Asociados
                </h3>
                <div className="flex flex-wrap gap-2">
                  {ticket.problemas_asociados.map((prob, i) => (
                    <Badge key={i} variant="secondary" className="bg-white/10 hover:bg-white/20">
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
                <div className="prose prose-invert max-w-none text-emerald-100/90 whitespace-pre-wrap leading-relaxed text-lg">
                  {ticket.solucion_propuesta || ticket.propuesta_solucion || "Procesando solución..."}
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

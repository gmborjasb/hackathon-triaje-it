import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Server, Activity, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export function Dashboard({ tickets, onTicketClick }) {
  if (!tickets || tickets.length === 0) return null;

  const total = tickets.length;
  const resueltos = tickets.filter(t => t.estado === 'RESUELTO').length;
  const procesando = tickets.filter(t => t.estado === 'PROCESANDO').length;
  const pendientes = tickets.filter(t => t.estado === 'PENDIENTE').length;
  const error = tickets.filter(t => t.estado === 'ERROR').length;
  
  const progressPercent = Math.round((resueltos / total) * 100) || 0;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Tickets" value={total} icon={<Server className="text-muted-foreground w-4 h-4" />} />
        <StatCard title="Procesados" value={resueltos} icon={<CheckCircle2 className="text-emerald-500 w-4 h-4" />} />
        <StatCard title="En Cola" value={pendientes + procesando} icon={<Activity className="text-blue-500 w-4 h-4" />} />
        <StatCard title="Errores" value={error} icon={<AlertCircle className="text-red-500 w-4 h-4" />} />
      </div>

      {/* Progress */}
      <Card className="bg-black/20 border-white/5 backdrop-blur-md">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Progreso del Lote</span>
            <span className="text-sm font-bold">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2 bg-white/10" />
        </CardContent>
      </Card>

      {/* Tickets List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {tickets.map((ticket) => (
          <TicketCard key={ticket.ticket_id} ticket={ticket} onClick={() => onTicketClick && onTicketClick(ticket)} />
        ))}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <Card className="bg-black/20 border-white/5 backdrop-blur-md">
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className="p-3 bg-white/5 rounded-full">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function TicketCard({ ticket, onClick }) {
  const isResuelto = ticket.estado === 'RESUELTO';
  const isProcesando = ticket.estado === 'PROCESANDO';

  const estadoConfig = {
    'PENDIENTE': { color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: <Clock className="w-3 h-3 mr-1" />, label: 'En Cola' },
    'PROCESANDO': { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: <Activity className="w-3 h-3 mr-1 animate-pulse" />, label: 'Analizando...' },
    'RESUELTO': { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: <CheckCircle2 className="w-3 h-3 mr-1" />, label: 'Resuelto' },
    'ERROR': { color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: <AlertCircle className="w-3 h-3 mr-1" />, label: 'Error' },
  };

  const urgenciaConfig = {
    'ALTA': 'bg-red-500/20 text-red-200 border-red-500/30',
    'MEDIA': 'bg-orange-500/20 text-orange-200 border-orange-500/30',
    'BAJA': 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30',
  };

  const status = estadoConfig[ticket.estado] || estadoConfig['PENDIENTE'];
  const urgColor = urgenciaConfig[ticket.urgencia?.toUpperCase()] || 'bg-white/10 text-white/70';

  return (
    <Card 
      onClick={onClick}
      className={`relative overflow-hidden transition-all duration-500 cursor-pointer ${isResuelto ? 'bg-emerald-950/20 border-emerald-500/20 hover:bg-emerald-950/40' : 'bg-black/40 border-white/10 hover:bg-black/60'} backdrop-blur-xl hover:border-white/30 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]`}
    >
      {/* Decorative top border */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${isResuelto ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-white/5'}`} />
      
      <CardHeader className="pb-3 pt-5">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            <CardTitle className="text-base font-mono text-muted-foreground flex items-center gap-2">
              #{ticket.ticket_id}
            </CardTitle>
          </div>
          <Badge variant="outline" className={`${status.color} flex items-center`}>
            {status.icon} {status.label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <p className="text-sm leading-relaxed text-white/90 mb-4 line-clamp-2 h-[40px] font-medium">
          {ticket.tema ? ticket.tema : ticket.texto_original}
        </p>
        
        {isResuelto ? (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={urgColor}>
                Urgencia: {ticket.urgencia}
              </Badge>
              <Badge variant="outline" className="bg-primary/20 text-primary-foreground border-primary/30">
                {ticket.departamento}
              </Badge>
            </div>
            
            <div className="bg-black/30 rounded-md p-3 text-sm text-emerald-200/80 border border-emerald-500/10 hover:border-emerald-500/30 transition-colors">
              <span className="font-semibold block text-emerald-400 mb-1">Click para ver detalle completo & RAG →</span>
              <p className="line-clamp-1 opacity-70">{ticket.propuesta_solucion}</p>
            </div>
          </div>
        ) : (
          <div className="h-[104px] flex items-center justify-center border border-dashed border-white/10 rounded-md bg-white/5">
            <span className="text-xs text-muted-foreground uppercase tracking-widest opacity-50">
              Esperando análisis...
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

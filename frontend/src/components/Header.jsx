import React from 'react';
import { BadgeCheck, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Header() {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/20 backdrop-blur-md sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-primary/20 rounded-lg">
          <Zap className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white">Triaje<span className="text-primary">IT</span></h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BadgeCheck className="w-4 h-4 text-emerald-500" />
          <span>Sistema Activo</span>
        </div>
        <Button variant="outline" size="sm" className="hidden sm:flex border-white/10 bg-white/5 hover:bg-white/10">
          Documentación
        </Button>
      </div>
    </header>
  );
}

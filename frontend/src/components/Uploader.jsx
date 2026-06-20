import React, { useCallback, useState } from 'react';
import Papa from 'papaparse';
import { UploadCloud, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function Uploader({ onUpload }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const processFile = (file) => {
    if (!file) return;
    
    // Check if CSV
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast({
        title: "Archivo inválido",
        description: "Por favor sube un archivo CSV válido.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setIsProcessing(false);
        const data = results.data;
        if (data.length === 0) {
          toast({
            title: "Archivo vacío",
            description: "El archivo CSV no contiene registros.",
            variant: "destructive"
          });
          return;
        }

        // Validate basic structure (we expect at least an ID and text)
        // If not present, we will map whatever we can or mock it
        const normalizedTickets = data.map((row, index) => ({
          ticket_id: row.ticket_id || row.id || `TICKET-${index + 1000}`,
          texto_original: row.texto || row.descripcion || row.texto_original || Object.values(row)[0],
          estado: 'PENDIENTE',
          urgencia: null,
          departamento: null,
          solucion_propuesta: null
        }));

        toast({
          title: "Archivo cargado con éxito",
          description: `Se detectaron ${normalizedTickets.length} tickets para procesar.`,
        });

        onUpload(normalizedTickets);
      },
      error: (error) => {
        setIsProcessing(false);
        toast({
          title: "Error al procesar",
          description: error.message,
          variant: "destructive"
        });
      }
    });
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <Card className="border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl">
      <CardHeader>
        <CardTitle>Cargar Tickets</CardTitle>
        <CardDescription>Sube un archivo CSV con los tickets que deseas procesar</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ease-out flex flex-col items-center justify-center gap-4 ${
            isDragging 
              ? 'border-primary bg-primary/10 scale-[1.02]' 
              : 'border-white/20 hover:border-white/40 hover:bg-white/5'
          }`}
        >
          <div className={`p-4 rounded-full ${isDragging ? 'bg-primary/20 text-primary' : 'bg-white/5 text-muted-foreground'}`}>
            <UploadCloud className="w-10 h-10" />
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-1">Arrastra tu archivo CSV aquí</h3>
            <p className="text-sm text-muted-foreground mb-4">o haz clic para buscar en tus archivos</p>
          </div>
          
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isProcessing}
          />
          
          <Button disabled={isProcessing} className="pointer-events-none">
            {isProcessing ? 'Procesando...' : 'Seleccionar Archivo'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

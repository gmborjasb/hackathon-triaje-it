# Frontend — Dashboard de Triaje IT

Esta carpeta contiene la aplicación web desarrollada en React 18 y empaquetada con Vite. Es la interfaz de usuario donde los agentes de soporte pueden subir tickets, ver su estado de procesamiento en tiempo real y consultar el historial a través de un Chatbot RAG (Retrieval-Augmented Generation).

## Stack Tecnológico

- Framework: React 18 + Vite 5
- Estilos: Tailwind CSS + shadcn/ui
- Iconografía: Lucide React
- Enrutamiento: React Router v6
- Markdown: `react-markdown` + `remark-gfm` (para renderizar respuestas del LLM)

## Variables de Entorno (.env)

Para que el frontend funcione, necesita conocer las direcciones públicas de los API Gateways desplegados en AWS.
Debes crear un archivo `.env` en esta carpeta con el siguiente formato:

```env
# URL del API Gateway que invoca el "LectorTickets" (Scan de DynamoDB)
VITE_API_URL_READ=https://<TU_API_ID_LECTOR>.execute-api.us-east-1.amazonaws.com/

# URL del API Gateway que invoca el "DispatcherTickets" (Recibir CSV)
VITE_API_URL_WRITE=https://<TU_API_ID_DISPATCHER>.execute-api.us-east-1.amazonaws.com/

# URL del API Gateway que invoca el "ChatbotRAG" (RAG + Pinecone)
VITE_API_URL_CHATBOT=https://<TU_API_ID_CHATBOT>.execute-api.us-east-1.amazonaws.com/
```

## Componentes Principales

| Componente | Archivo | Responsabilidad |
|---|---|---|
| Dashboard | `src/components/Dashboard.jsx` | Grilla de tickets con actualización en tiempo real, barras de progreso y contadores de estados (Resuelto, Procesando, Error). |
| Uploader | `src/components/Uploader.jsx` | Parsea los archivos CSV a JSON y hace el envío (POST) al API Gateway Dispatcher. |
| ChatbotGlobal | `src/components/ChatbotGlobal.jsx` | Chatbot flotante que envía preguntas al API Gateway ChatbotRAG, soportando contexto global o de un ticket específico. Renderiza Markdown. |
| TicketDetailModal | `src/components/TicketDetailModal.jsx` | Muestra el desglose de la IA (problema principal, solución propuesta, urgencia, etc.). |
| Header | `src/components/Header.jsx` | Barra de navegación superior con diseño minimalista. |

## Cómo Ejecutar en Local

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Asegurarte de tener configurado el archivo `.env`.

3. Levantar el servidor de desarrollo:
   ```bash
   npm run dev
   ```

El servidor estará disponible en http://localhost:5173.

## Despliegue en AWS Amplify (Producción)

Dado que los roles de IAM pueden estar restringidos en entornos de AWS Academy, el despliegue a **AWS Amplify** se realiza mediante un script de actualización manual preconfigurado.

Si realizas cambios en el código de React y deseas publicarlos en la nube, ejecuta desde la raíz del proyecto:

```bash
python3 infraestructura/update_amplify.py
```

Este script automáticamente:
1. Re-compilará el proyecto para producción (`npm run build`).
2. Empaquetará la carpeta `dist/` en un archivo `.zip`.
3. Subirá el paquete directamente a la aplicación de AWS Amplify configurada.
4. Tu URL seguirá siendo la misma pero con los últimos cambios en vivo.

## Características Especiales
- Polling Automático: La vista Home consulta el estado de los tickets (`LectorAPI`) cada 3 segundos automáticamente para reflejar los cambios realizados por la Lambda de IA en AWS de manera fluida.
- Dark Mode UI: Interfaz inmersiva con colores vibrantes y desenfoques (backdrop-blur) optimizada para ambientes nocturnos de centros de datos.
- RAG Interactivo: Al preguntar en el Chatbot, se genera una burbuja de chat nativa y se espera la respuesta asíncrona de AWS.

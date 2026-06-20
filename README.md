# Triaje-IT — Sistema Inteligente de Triaje de Tickets IT

Triaje-IT es un proyecto desarrollado para el Hackathon Multicloud. Se trata de un sistema inteligente de procesamiento, triaje y resolución automática de incidencias técnicas (Tickets IT) utilizando servicios en la nube, Inteligencia Artificial Generativa y Bases de Datos Vectoriales (RAG).

## Arquitectura

El proyecto emplea una arquitectura Serverless distribuida principalmente en Amazon Web Services (AWS) con integración demostrativa en Oracle Cloud Infrastructure (OCI).

[Ver Diagrama de Arquitectura Completo (ARQUITECTURA.md)](./ARQUITECTURA.md)

### Stack Tecnológico
| Categoría | Tecnología Utilizada |
|---|---|
| Backend AWS | AWS Lambda (4 funciones), Amazon DynamoDB, Amazon SQS, API Gateway (HTTP APIs) |
| Backend OCI | Oracle Functions, API Gateway, Container Registry |
| Inteligencia Artificial | Groq API (LLM: `llama-3.1-8b-instant`) |
| Motor RAG (Vector DB) | Pinecone Serverless (`triaje-tickets`, modelo: `multilingual-e5-large`) |
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui (Alojado en **AWS Amplify**) |

---

## Estructura del Proyecto

```text
hackathon-triaje-it/
├── ARQUITECTURA.md              # Diagrama Mermaid de Arquitectura
├── frontend/                    # Aplicación React + Vite
│   ├── README.md                # Documentación Frontend
│   └── src/                     # Código fuente (Dashboard, Chatbot, Uploader)
├── backend-aws/                 # Código de las 4 funciones AWS Lambda
│   ├── README.md                # Documentación Backend AWS
│   ├── lambda_dispatcher/       # Guarda tickets en DynamoDB y SQS
│   ├── lambda_lector/           # Obtiene tickets para el dashboard
│   ├── lambda_procesador/       # Analiza tickets con Groq LLM y guarda vectores en Pinecone
│   └── lambda_chatbot/          # Motor RAG conversacional (Pinecone + Groq)
├── backend-oci/                 # Función de despacho en Oracle Cloud
│   ├── README.md                # Documentación Backend OCI
│   └── dispatcher/              # Función serverless en OCI
├── infraestructura/             # Artefactos empaquetados (.zip) para despliegue AWS
└── tickets_prueba_30.csv        # Set de datos con 30 incidencias reales IT para probar el sistema
```

---

## Inicio Rápido (Quick Start)

### 1. Prerrequisitos
- Node.js v18+
- AWS CLI configurado (`~/.aws/credentials`)
- Cuenta en Groq Cloud (API Key)
- Cuenta en Pinecone (API Key)

### 2. Configurar Variables de Entorno (Frontend)
Duplica el archivo `frontend/.env.example` (o crea un `.env` en la carpeta `frontend/`) y añade las URLs generadas por tus API Gateways de AWS:
```env
VITE_API_URL_READ=https://<API_ID_LECTOR>.execute-api.us-east-1.amazonaws.com/
VITE_API_URL_WRITE=https://<API_ID_DISPATCHER>.execute-api.us-east-1.amazonaws.com/
VITE_API_URL_CHATBOT=https://<API_ID_CHATBOT>.execute-api.us-east-1.amazonaws.com/
```

### 3. Levantar el Frontend
```bash
cd frontend
npm install
npm run dev
# El dashboard estará disponible en http://localhost:5173
```

### 4. Probar el sistema
- Entra a `http://localhost:5173`.
- Sube el archivo `tickets_prueba_30.csv` alojado en la raíz de este proyecto.
- Observa cómo el panel en tiempo real cambia el estado de los tickets de "En Cola" a "Procesando" y luego a "Resuelto" gracias a Llama 3.1.
- Abre el Chatbot RAG y pregúntale: "¿Cómo se resolvió el ticket TKT-2004?" o haz preguntas generales de conocimiento técnico de la empresa.

---

## Documentación Detallada por Componente

Para instrucciones sobre cómo recrear y empaquetar manualmente las lambdas de AWS o entender cómo compilar la función de OCI, revisa los READMEs específicos:

- [Documentación del Frontend](./frontend/README.md)
- [Documentación del Backend AWS](./backend-aws/README.md)
- [Documentación del Backend OCI](./backend-oci/README.md)

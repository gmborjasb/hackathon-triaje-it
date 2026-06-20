# Triaje-IT — Sistema Inteligente de Triaje de Tickets IT

Triaje-IT es un proyecto desarrollado para el Hackathon Multicloud. Se trata de un sistema inteligente de procesamiento, triaje y resolución automática de incidencias técnicas (Tickets IT) utilizando servicios en la nube, Inteligencia Artificial Generativa y Bases de Datos Vectoriales (RAG).

**Aplicacion en produccion:** https://main.d1i6a7mh99zymh.amplifyapp.com

---

## Arquitectura

El proyecto emplea una arquitectura Serverless distribuida principalmente en Amazon Web Services (AWS) con integración demostrativa en Oracle Cloud Infrastructure (OCI).

[Ver Diagrama de Arquitectura Completo (ARQUITECTURA.md)](./ARQUITECTURA.md)

### Stack Tecnológico

| Categoría | Tecnología Utilizada |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui (Alojado en **AWS Amplify**) |
| API Layer | AWS API Gateway HTTP (`TriajeAPI`) con CORS global |
| Backend AWS | AWS Lambda — 4 funciones Python 3.9 |
| Cola de mensajes | Amazon SQS (`tickets-queue` + DLQ) |
| Base de datos | Amazon DynamoDB (tabla `Tickets`, PAY_PER_REQUEST) |
| Inteligencia Artificial | Groq API (LLM: `llama-3.1-8b-instant`) |
| Motor RAG (Vector DB) | Pinecone Serverless (`triaje-tickets`, modelo: `multilingual-e5-large`) |
| Backend OCI (parcial) | Oracle Functions, API Gateway, Container Registry |
| Despliegue IaC | Scripts Bash + Python en `infraestructura/` |

---

## Estructura del Proyecto

```text
hackathon-triaje-it/
├── ARQUITECTURA.md                      # Diagrama Mermaid + estado de despliegue
├── README.md                            # Este archivo
├── tickets_prueba_30.csv                # 30 incidencias IT reales para demostrar el sistema
├── frontend/                            # Aplicación React + Vite
│   ├── README.md
│   ├── .env                             # Variables de entorno (URLs del API Gateway)
│   └── src/                             # Dashboard, Chatbot, Uploader
├── backend-aws/                         # Código fuente de las 4 Lambdas
│   ├── README.md
│   ├── lambda_dispatcher/               # Recibe CSV -> DynamoDB + SQS
│   ├── lambda_lector/                   # Lee tickets desde DynamoDB
│   ├── lambda_procesador/               # Analiza con Groq LLM + Pinecone (RAG indexing)
│   └── lambda_chatbot/                  # Motor RAG conversacional (Pinecone + Groq)
├── backend-oci/                         # Función dispatcher en Oracle Cloud (parcial)
│   ├── README.md
│   └── dispatcher/
└── infraestructura/                     # Scripts de despliegue
    ├── deploy_disaster_recovery.sh      # Reconstruye toda la infraestructura desde cero
    ├── update_amplify.py                # Compila y actualiza el frontend en Amplify
    └── deploy_amplify.py                # Crea una nueva app en Amplify
```

---

## Inicio Rápido (Quick Start)

### 1. Prerrequisitos
- Node.js v18+
- Python 3.9+
- AWS CLI configurado (`~/.aws/credentials`) con credenciales de AWS Academy
- Cuenta en Groq Cloud (API Key)
- Cuenta en Pinecone (API Key)

### 2. Configurar Variables de Entorno (Frontend)
Crea un archivo `.env` en la carpeta `frontend/` con las URLs del API Gateway de tu despliegue:
```env
VITE_API_URL_READ=https://<API_ID>.execute-api.us-east-1.amazonaws.com/tickets
VITE_API_URL_WRITE=https://<API_ID>.execute-api.us-east-1.amazonaws.com/upload
VITE_API_URL_CHATBOT=https://<API_ID>.execute-api.us-east-1.amazonaws.com/query
```

### 3. Levantar el Frontend en Local
```bash
cd frontend
npm install
npm run dev
# El dashboard estará disponible en http://localhost:5173
```

### 4. Redespliegue Completo (Disaster Recovery)
Si tu cuenta de AWS Academy se reinicia, puedes recrear toda la infraestructura en ~5 minutos:
```bash
export GROQ_API_KEY="tu_groq_api_key"
export PINECONE_API_KEY="tu_pinecone_api_key"
./infraestructura/deploy_disaster_recovery.sh
```

### 5. Probar el Sistema
- Entra a https://main.d1i6a7mh99zymh.amplifyapp.com (o `http://localhost:5173` en local).
- Sube el archivo `tickets_prueba_30.csv` desde el panel de carga.
- Observa cómo el estado de los tickets cambia de `PENDIENTE` a `RESUELTO` gracias a Llama 3.1.
- Abre el Chatbot y pregunta: "Como se resolvio el problema de red?" para ver el motor RAG en accion.

---

## Documentacion Detallada por Componente

- [Documentacion del Frontend](./frontend/README.md)
- [Documentacion del Backend AWS](./backend-aws/README.md)
- [Documentacion del Backend OCI](./backend-oci/README.md)

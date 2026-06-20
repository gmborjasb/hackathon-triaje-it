# Arquitectura del Sistema: Triaje-IT

El proyecto implementa una arquitectura multicloud orientada a eventos, serverless y con capacidades de Inteligencia Artificial (LLM + Vector DB) para automatizar el triaje y resolución de tickets de soporte técnico IT.

## Estado Actual del Despliegue

| Componente | URL / Identificador | Estado |
|---|---|---|
| Frontend (Amplify) | https://main.d1i6a7mh99zymh.amplifyapp.com | Activo |
| API Gateway (HTTP) | https://d8ali1wk47.execute-api.us-east-1.amazonaws.com | Activo |
| Lambda LectorTickets | `/tickets` (GET) | Activo |
| Lambda DispatcherTickets | `/upload` (POST) | Activo |
| Lambda ChatbotRAG | `/query` (POST) | Activo |
| Lambda ProcesarTicketGroq | SQS Trigger (batch=1, concurrency=3) | Activo |
| DynamoDB | Tabla `Tickets` (us-east-1) | Activo |
| SQS | `tickets-queue` + `tickets-dlq` | Activo |
| Pinecone | Índice `triaje-tickets` (multilingual-e5-large) | Activo |
| Groq | Modelo `llama-3.1-8b-instant` | Activo |

---

## Diagrama de Arquitectura Detallado

```mermaid
graph TD
    %% Usuarios y Frontend
    User(("Usuario<br/>(Soporte IT)"))

    subgraph "AWS Edge / CDN"
        Frontend["React Frontend<br/>(AWS Amplify Hosting)"]
    end

    User <-->|HTTPS| Frontend

    %% Región OCI Secundaria (Parcialmente implementada)
    subgraph "Oracle Cloud Infrastructure (sa-saopaulo-1)"
        subgraph "Public Subnet (10.1.1.0/24)"
            OCIGW["API Gateway<br/>(TriajeGateway)"]
            OCIFN["λ Function<br/>(dispatcher)"]
            OCIGW -->|Invoke| OCIFN
        end
        noteOCI>Restricción de red: Falta NAT Gateway para salida a internet]
        OCIFN -.- noteOCI
    end

    %% Región AWS Principal
    subgraph "Amazon Web Services (us-east-1)"

        subgraph "API Layer"
            APIGW["API Gateway HTTP<br/>(TriajeAPI - d8ali1wk47)<br/>CORS: AllowOrigins=*"]
        end

        subgraph "Compute (Lambda)"
            L_Write["λ DispatcherTickets<br/>(Python 3.9)"]
            L_Read["λ LectorTickets<br/>(Python 3.9)"]
            L_Process["λ ProcesarTicketGroq<br/>(Python 3.9 / Concurrency=3)"]
            L_Chat["λ ChatbotRAG<br/>(Python 3.9)"]
        end

        subgraph "Storage & Messaging"
            SQS["Amazon SQS<br/>(tickets-queue / DLQ tras 3 intentos)"]
            DDB[("Amazon DynamoDB<br/>(Tickets — PAY_PER_REQUEST)")]
        end

        %% Rutas API Gateway -> Lambda
        APIGW -->|"ANY /upload"| L_Write
        APIGW -->|"ANY /tickets"| L_Read
        APIGW -->|"ANY /query"| L_Chat

        %% Flujo de datos interno
        L_Write -->|PutItem (estado=PENDIENTE)| DDB
        L_Write -->|SendMessage| SQS
        L_Read -->|Scan/GetItem| DDB
        SQS -->|"Event Trigger (batch=1)"| L_Process
        L_Process -->|UpdateItem (estado=RESUELTO)| DDB
    end

    %% Servicios de IA Externos
    subgraph "External AI Services"
        Groq["Groq API<br/>(Llama-3.1-8b-instant)"]
        Pinecone[("Pinecone Vector DB<br/>(triaje-tickets / multilingual-e5-large)")]
    end

    %% Conexiones Frontend -> API Gateway
    Frontend -->|"POST /upload (CSV)"| APIGW
    Frontend -->|"GET /tickets (polling 3s)"| APIGW
    Frontend -->|"POST /query (RAG)"| APIGW

    %% Conexiones Lambda -> IA
    L_Process <-->|Clasificar y resolver| Groq
    L_Process -->|Embed & Upsert vector| Pinecone
    L_Chat <-->|Query top-3 vectors| Pinecone
    L_Chat <-->|Generar respuesta RAG| Groq
```

---

## Explicación del Flujo de Datos

### 1. Ingesta de Tickets (Dispatcher)
El React Frontend (alojado en AWS Amplify) parsea el archivo CSV y lo envía como JSON a la ruta `POST /upload` del API Gateway HTTP `TriajeAPI`. Este invoca la Lambda `DispatcherTickets`, que itera sobre cada ticket, lo persiste en DynamoDB con estado `PENDIENTE` y encola un mensaje en Amazon SQS para su procesamiento asíncrono.

### 2. Procesamiento Inteligente (AI)
Amazon SQS actúa como trigger (Event Source Mapping) e invoca automáticamente la Lambda `ProcesarTicketGroq` en batches de 1 mensaje para respetar los rate limits de Groq (6,000 TPM). La concurrencia reservada está configurada a 3 para evitar errores 429:
- El LLM `Llama-3.1-8b-instant` de Groq analiza el ticket, lo categoriza (urgencia, tipo) y propone una solución técnica.
- Una vez procesado, actualiza el estado a `RESUELTO` en DynamoDB.
- Finalmente, genera un Vector (Embedding) usando el modelo `multilingual-e5-large` de Pinecone Inference y lo inserta en el índice Serverless de Pinecone para alimentar el motor RAG.
- Si Groq devuelve un error 429 (rate limit), la Lambda devuelve el mensaje a la cola SQS para ser reintentado automáticamente hasta 3 veces antes de enviarse a la DLQ.

### 3. Motor RAG Conversacional (Chatbot)
El usuario interactúa con el Chatbot flotante del dashboard. Al enviar una pregunta, el frontend llama a `POST /query`. La Lambda `ChatbotRAG`:
1. Genera un embedding de la pregunta con `multilingual-e5-large`.
2. Busca los 3 vectores más similares en Pinecone (tickets históricos resueltos).
3. Construye un prompt de sistema enriquecido con esos tickets como contexto.
4. Llama a `Llama-3.1-8b-instant` para generar una respuesta en Markdown basada en el historial real.

### 4. Seguridad y Red (AWS)
- Las 3 funciones Lambda orientadas al frontend están expuestas a través de un único **API Gateway HTTP** (`TriajeAPI`) con CORS habilitado globalmente (`AllowOrigins: *`).
- Toda la infraestructura (DynamoDB, SQS, Lambda) corre bajo el rol IAM `LabRole` proporcionado por AWS Academy.
- Oracle Cloud Infrastructure (OCI) se configuró como entrada multicloud alternativa, pero por restricciones de red del entorno académico (ausencia de NAT Gateway en la subred pública), la arquitectura principal recae enteramente en AWS.

### 5. Nota sobre AWS Academy (Despliegue)
El laboratorio de AWS Academy tiene una duración de sesión de 4 horas y un presupuesto acotado. Para simplificar el redespliegue ante reinicios del laboratorio, el proyecto incluye el script `infraestructura/deploy_disaster_recovery.sh`. Para actualizar el Frontend en Amplify después de cualquier cambio de código, se usa `python3 infraestructura/update_amplify.py`.

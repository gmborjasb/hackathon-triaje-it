# Arquitectura del Sistema: Triaje-IT

El proyecto implementa una arquitectura multicloud orientada a eventos, serverless y con capacidades de Inteligencia Artificial (LLM + Vector DB) para automatizar el triaje y resolución de tickets de soporte técnico IT.

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
        VCN["VCN: TriajeVCN (10.1.0.0/16)"]
        
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
        VPC["VPC Principal (10.0.0.0/16)"]
        
        subgraph "Public Subnet (10.0.1.0/24)"
            SG_API["SG: sg-apigw<br/>Inbound: 443 (0.0.0.0/0)"]
            
            GW_Write["API Gateway<br/>(DispatcherAPI)"]
            GW_Read["API Gateway<br/>(LectorAPI)"]
            GW_Chat["API Gateway<br/>(ChatbotAPI)"]
        end
        
        subgraph "Private Subnet (10.0.2.0/24)"
            SG_LAMBDA["SG: sg-lambda<br/>Inbound: sg-apigw<br/>Outbound: 0.0.0.0/0"]
            
            L_Write["λ DispatcherTickets<br/>(Python 3.9)"]
            L_Read["λ LectorTickets<br/>(Python 3.9)"]
            L_Process["λ ProcesarTicketGroq<br/>(Python 3.9)"]
            L_Chat["λ ChatbotRAG<br/>(Python 3.9)"]
            
            SQS["Amazon SQS<br/>(tickets-queue)"]
            DDB[("Amazon DynamoDB<br/>(Tickets Table)")]
        end
        
        %% Conexiones internas AWS
        GW_Write -->|HTTPS / Invoke| L_Write
        GW_Read -->|HTTPS / Invoke| L_Read
        GW_Chat -->|HTTPS / Invoke| L_Chat
        
        L_Write -->|PutItem| DDB
        L_Write -->|SendMessage| SQS
        L_Read -->|Scan/GetItem| DDB
        
        SQS -->|Event Trigger| L_Process
        L_Process -->|UpdateItem| DDB
    end

    %% Servicios de IA Externos
    subgraph "External AI Services"
        Groq["Groq API<br/>(Llama-3.1-8b-instant)"]
        Pinecone[("Pinecone Vector DB<br/>(triaje-tickets)")]
    end

    %% Conexiones Frontend -> AWS
    Frontend -->|POST /upload| GW_Write
    Frontend -->|GET /tickets| GW_Read
    Frontend -->|POST /query| GW_Chat

    %% Conexiones Lambda -> AI
    L_Process <-->|HTTPS API Auth| Groq
    L_Process -->|Embed & Upsert| Pinecone
    L_Chat <-->|Query Vectors| Pinecone
    L_Chat <-->|Generate Answer| Groq
```

## Explicación del Flujo de Datos

### 1. Ingesta de Tickets (Dispatcher)
El React Frontend envía un archivo CSV parseado como JSON al DispatcherAPI (API Gateway HTTP). Esta petición invoca la Lambda `DispatcherTickets`. La función itera sobre cada ticket, lo guarda en DynamoDB con estado `PENDIENTE` e introduce un mensaje en la cola Amazon SQS para su procesamiento asíncrono.

### 2. Procesamiento Inteligente (AI)
El servicio SQS actúa como trigger e invoca automáticamente la Lambda `ProcesarTicketGroq`. 
- La función extrae el problema del usuario y se conecta a la API de Groq utilizando el LLM `Llama-3.1-8b-instant` para analizar el ticket, categorizarlo y proponer una solución técnica.
- Una vez procesado, actualiza el estado a `RESUELTO` en DynamoDB.
- Finalmente, se conecta a Pinecone Inference API para generar un Vector (Embedding) usando `multilingual-e5-large` y lo inserta en el índice Serverless de Pinecone para alimentar el motor RAG.

### 3. Motor RAG Conversacional (Chatbot)
El usuario puede interactuar con un Chatbot dentro del dashboard. 
Al hacer una pregunta, el frontend llama al ChatbotAPI. La Lambda `ChatbotRAG` genera un embedding de la pregunta, busca los 3 vectores (tickets) más similares matemáticamente en Pinecone, y le pasa estos tickets históricos a Llama 3.1 como Contexto. Llama 3.1 formula una respuesta amigable y certera basándose estrictamente en las resoluciones pasadas.

### 4. Seguridad y Red (AWS)
- Las 3 funciones Lambda orientadas al frontend están expuestas a través de API Gateways que manejan las peticiones preflight de CORS (`OPTIONS`).
- Toda la base de datos (DynamoDB) y el encolamiento (SQS) se ejecutan dentro del ecosistema gestionado de AWS con roles IAM restrictivos (`LabRole`).
- Oracle Cloud Infrastructure (OCI) se configuró como una opción de entrada multicloud, pero debido a restricciones de red (ausencia de un NAT Gateway para la Subred Pública configurada), la arquitectura principal recae enteramente en la infraestructura de AWS.

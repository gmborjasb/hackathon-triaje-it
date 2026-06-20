# Backend AWS — Funciones Lambda Serverless

Este directorio contiene el código fuente en Python de las 4 funciones AWS Lambda que conforman el corazón del procesamiento, almacenamiento y razonamiento del sistema Triaje-IT.

La arquitectura sigue un patrón asíncrono y orientado a eventos:
`API Gateway -> Lambda -> DynamoDB -> SQS -> Lambda -> Groq/Pinecone`

## Funciones Lambda

### 1. `DispatcherTickets`
- Ubicación: `lambda_dispatcher/app.py`
- Responsabilidad: Recibe el array JSON del frontend (vía API Gateway), valida el formato, guarda cada ticket en la base de datos DynamoDB con el estado `PENDIENTE` y empuja un mensaje a la cola SQS por cada ticket para su procesamiento asíncrono.
- Trigger: HTTP POST (API Gateway `DispatcherAPI`)
- Variables de Entorno: `SQS_QUEUE_URL` (URL de la cola SQS)

### 2. `ProcesarTicketGroq`
- Ubicación: `lambda_procesador/app.py`
- Responsabilidad: Es el "Cerebro" del sistema. Lee los mensajes encolados de SQS, marca el ticket como `PROCESANDO`, se conecta a la API de Groq (Llama 3.1) para analizar el problema y generar una solución. Luego guarda el resultado en DynamoDB (`RESUELTO`). Finalmente, envía el texto completo a Pinecone Inference API para crear el Vector (Embedding) y guardarlo en la base de datos vectorial para el Chatbot.
- Trigger: Mensajes de SQS (`tickets-queue`)
- Variables de Entorno: `GROQ_API_KEY`, `PINECONE_API_KEY`, `PINECONE_HOST`
- Dependencias Especiales: `groq` (debe estar empaquetada para Linux, ver abajo).

### 3. `LectorTickets`
- Ubicación: `lambda_lector/app.py`
- Responsabilidad: Función de sólo lectura. Realiza un Scan o GetItem sobre DynamoDB para devolver la lista de tickets al Frontend y permitir el pintado del Dashboard en tiempo real.
- Trigger: HTTP GET (API Gateway `LectorAPI`)

### 4. `ChatbotRAG`
- Ubicación: `lambda_chatbot/app.py`
- Responsabilidad: Motor conversacional. Recibe la pregunta del usuario desde el dashboard, la convierte en un embedding matemático, busca similitudes en el índice `triaje-tickets` de Pinecone y le envía los tickets históricos encontrados al LLM de Groq para generar una respuesta fundamentada (RAG).
- Trigger: HTTP POST (API Gateway `ChatbotAPI`)
- Variables de Entorno: `GROQ_API_KEY`, `PINECONE_API_KEY`, `PINECONE_HOST`
- Dependencias Especiales: `groq`.

---

## Cómo empaquetar dependencias (Linux/AWS)

Como AWS Lambda se ejecuta sobre Amazon Linux y los paquetes pip a veces tienen binarios compilados en C (como `pydantic`), si estás trabajando desde un Mac o Windows, DEBES forzar la descarga de los paquetes en versión `manylinux`. 

Para `ProcesarTicketGroq` y `ChatbotRAG`, corre esto en sus respectivas carpetas antes de crear el zip:

```bash
# Descarga la librería de groq específicamente para la arquitectura de Lambda
pip3 install groq -t . --platform manylinux2014_x86_64 --only-binary=:all:
```

---

## Script Rápido de Despliegue

Si necesitas volver a subir los zips después de modificar el código localmente:

```bash
# 1. Dispatcher
cd lambda_dispatcher
zip -r ../dispatcher.zip app.py
aws lambda update-function-code --function-name DispatcherTickets --zip-file fileb://../dispatcher.zip

# 2. Procesador
cd ../lambda_procesador
zip -r ../procesador.zip .
aws lambda update-function-code --function-name ProcesarTicketGroq --zip-file fileb://../procesador.zip

# 3. Chatbot
cd ../lambda_chatbot
# Asegúrate de copiar las librerías de procesador aquí primero
cp -r ../lambda_procesador/* . 
zip -r ../chatbot.zip .
aws lambda update-function-code --function-name ChatbotRAG --zip-file fileb://../chatbot.zip

# 4. Lector
cd ../lambda_lector
zip -r ../lector.zip app.py
aws lambda update-function-code --function-name LectorTickets --zip-file fileb://../lector.zip
```

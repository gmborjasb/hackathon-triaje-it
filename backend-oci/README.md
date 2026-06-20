# Backend OCI — Oracle Cloud Infrastructure

> [!CAUTION]
> ESTADO: PARCIALMENTE IMPLEMENTADO / CON RESTRICCIONES DE RED

Este directorio contiene la función `dispatcher` desarrollada para correr bajo Oracle Cloud Infrastructure (OCI) utilizando Fn Project.

El propósito original de esta función era actuar como el punto de entrada multicloud: recibir los tickets desde el Frontend, y enviarlos trans-cloud hacia el DynamoDB y SQS de AWS.

## Limitaciones Encontradas

Durante el hackathon, se desplegó exitosamente:
- El componente VCN (Virtual Cloud Network: `TriajeVCN`).
- Una Subred Pública.
- El Oracle Container Registry (OCIR) (`gru.ocir.io/grgu18zglzoh/triaje-repo/dispatcher`).
- El servicio Serverless Oracle Functions (App: `TriajeApp`).
- El Oracle API Gateway (`TriajeGateway`).

Sin embargo, la función no logra enviar los datos a AWS por problemas de red de OCI:
Las Oracle Functions se ejecutan dentro de la subred, pero si la subred no cuenta con un NAT Gateway debidamente configurado en sus Route Tables, la función no tiene salida a Internet.
Dado que DynamoDB y SQS de AWS son endpoints públicos de internet, las llamadas HTTP desde OCI (`boto3`) se quedan colgadas esperando respuesta hasta hacer Timeout.

## Código Fuente

El código en `dispatcher/func.py` está completo y es funcional. Importa `boto3`, toma las credenciales inyectadas y escribe en DynamoDB y SQS:

```python
# Ejemplo de lo que intenta hacer (ver func.py para el código real)
sqs = boto3.client('sqs')
dynamodb = boto3.resource('dynamodb')

tabla = dynamodb.Table('Tickets')
tabla.put_item(Item=ticket_db)
sqs.send_message(QueueUrl=queue_url, MessageBody=json.dumps(...))
```

## Posible Solución

Para arreglar este componente y completar la estrategia 100% multicloud, se debe:
1. Ir a la Consola de OCI.
2. Entrar a la `TriajeVCN`.
3. Crear un NAT Gateway.
4. Ir a las Route Tables de la subred donde vive la Function.
5. Añadir una regla: `Destination: 0.0.0.0/0` -> `Target: (El NAT Gateway creado)`.

Por el momento, el frontend apunta directamente al API Gateway de AWS para evitar cuellos de botella en la demostración.

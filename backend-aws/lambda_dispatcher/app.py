import json
import boto3
import uuid
import os
from datetime import datetime, timezone

dynamodb = boto3.resource('dynamodb')
sqs = boto3.client('sqs')

tabla = dynamodb.Table('Tickets')

# Extraemos la URL de la cola de las variables de entorno, o definimos una por defecto
QUEUE_URL = os.environ.get("SQS_QUEUE_URL")

def lambda_handler(event, context):
    timestamp = datetime.now(timezone.utc).isoformat()
    print(f"[{timestamp}] 📨 Recibido evento Dispatcher:", json.dumps(event))
    
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "OPTIONS,POST"
    }

    # Handle CORS preflight OPTIONS request
    if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS' or event.get('httpMethod') == 'OPTIONS':
        print(f"[{timestamp}] ✅ Respondiendo a preflight OPTIONS")
        return {
            "statusCode": 200,
            "headers": headers,
            "body": ""
        }

    try:
        # El frontend envía un array de tickets en el body
        body = json.loads(event.get("body", "[]"))
        if not isinstance(body, list):
            raise ValueError("El body debe ser un array JSON de tickets.")
            
        if not QUEUE_URL:
            # Intentar deducir la URL si no está en ENV (por defecto us-east-1)
            # Esto es un fallback en caso de no inyectarlo en el script
            account_id = context.invoked_function_arn.split(":")[4]
            region = context.invoked_function_arn.split(":")[3]
            cola_url = f"https://sqs.{region}.amazonaws.com/{account_id}/tickets-queue"
        else:
            cola_url = QUEUE_URL

        batch_id = str(uuid.uuid4())[:8]
        procesados = 0
        fallidos = 0
        errores = []

        print(f"[{timestamp}] 📋 Procesando batch {batch_id} con {len(body)} tickets")

        for idx, item in enumerate(body):
            try:
                # Asignar un ID si no lo tiene
                ticket_id = item.get("ticket_id", f"TKT-{batch_id}-{idx}")
                texto = item.get("texto_original", item.get("texto", ""))
                
                # Validar que texto no esté vacío ni sea solo whitespace
                if not texto or not texto.strip():
                    print(f"[{timestamp}] ⚠️ Ticket {ticket_id} omitido: texto vacío o solo espacios")
                    fallidos += 1
                    errores.append({"ticket_id": ticket_id, "error": "Texto vacío o solo espacios en blanco"})
                    continue
                    
                ticket_db = {
                    "ticket_id": ticket_id,
                    "batch_id": batch_id,
                    "texto_original": texto,
                    "estado": "PENDIENTE"
                }
                
                # 1. Guardar en DynamoDB
                tabla.put_item(Item=ticket_db)
                
                # 2. Enviar a SQS
                sqs.send_message(
                    QueueUrl=cola_url,
                    MessageBody=json.dumps({"ticket_id": ticket_id, "texto": texto})
                )
                procesados += 1
                print(f"[{timestamp}] ✅ Ticket {ticket_id} despachado correctamente")

            except Exception as ticket_error:
                fallidos += 1
                error_msg = str(ticket_error)
                errores.append({"ticket_id": item.get("ticket_id", f"TKT-{batch_id}-{idx}"), "error": error_msg})
                print(f"[{timestamp}] ❌ Error procesando ticket idx={idx}: {error_msg}")

        print(f"[{timestamp}] 📊 Batch {batch_id} finalizado: {procesados} procesados, {fallidos} fallidos")

        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps({
                "message": "Tickets despachados exitosamente",
                "batch_id": batch_id,
                "total_procesados": procesados,
                "total_fallidos": fallidos,
                "errores": errores
            })
        }

    except Exception as e:
        print(f"[{timestamp}] 💥 Error general en Dispatcher: {str(e)}")
        return {
            "statusCode": 500,
            "headers": headers,
            "body": json.dumps({"error": str(e)})
        }

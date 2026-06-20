import io
import json
import logging
import uuid
import boto3
from fdk import response

# Inicializar clientes de AWS usando boto3 (las credenciales deben inyectarse por variables de entorno en OCI)
# AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, SQS_QUEUE_URL
sqs = boto3.client('sqs')
dynamodb = boto3.resource('dynamodb')

def handler(ctx, data: io.BytesIO = None):
    try:
        body = json.loads(data.getvalue())
        
        # Asume que recibe un array de tickets
        if not isinstance(body, list):
            raise ValueError("El payload debe ser un array JSON de tickets.")
            
        cfg = ctx.Config()
        queue_url = cfg.get("SQS_QUEUE_URL")
        tabla = dynamodb.Table('Tickets')
        
        batch_id = str(uuid.uuid4())[:8]
        procesados = 0

        for idx, item in enumerate(body):
            ticket_id = item.get("ticket_id", f"TKT-{batch_id}-{idx}")
            texto = item.get("texto_original", item.get("texto", ""))
            
            if not texto:
                continue
                
            ticket_db = {
                "ticket_id": ticket_id,
                "batch_id": batch_id,
                "texto_original": texto,
                "estado": "PENDIENTE"
            }
            
            # 1. Guardar en DynamoDB AWS desde OCI
            tabla.put_item(Item=ticket_db)
            
            # 2. Enviar a SQS AWS desde OCI
            sqs.send_message(
                QueueUrl=queue_url,
                MessageBody=json.dumps({"ticket_id": ticket_id, "texto": texto})
            )
            procesados += 1

        return response.Response(
            ctx, response_data=json.dumps(
                {"message": "Tickets despachados exitosamente desde OCI a AWS", "batch_id": batch_id, "procesados": procesados}
            ),
            headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
        )

    except (Exception, ValueError) as ex:
        logging.getLogger().info('error: ' + str(ex))
        return response.Response(
            ctx, response_data=json.dumps({"error": str(ex)}),
            headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            status_code=500
        )

import json
import boto3
import decimal
from boto3.dynamodb.conditions import Attr

class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, decimal.Decimal):
            return str(o)
        return super(DecimalEncoder, self).default(o)

dynamodb = boto3.resource('dynamodb')
tabla = dynamodb.Table('Tickets')

def lambda_handler(event, context):
    print("📖 Recibido evento Lector:", json.dumps(event))
    
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "OPTIONS,GET"
    }

    # Handle CORS preflight OPTIONS request
    if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS' or event.get('httpMethod') == 'OPTIONS':
        print("✅ Respondiendo a preflight OPTIONS")
        return {
            "statusCode": 200,
            "headers": headers,
            "body": ""
        }

    try:
        query_params = event.get("queryStringParameters") or {}
        ticket_id = query_params.get("ticket_id")
        batch_id = query_params.get("batch_id")

        if ticket_id:
            # Obtener un solo ticket
            print(f"🔍 Buscando ticket individual: {ticket_id}")
            response = tabla.get_item(Key={"ticket_id": ticket_id})
            item = response.get("Item")
            if not item:
                print(f"⚠️ Ticket {ticket_id} no encontrado")
                return {
                    "statusCode": 404,
                    "headers": headers,
                    "body": json.dumps({"error": "Ticket no encontrado"})
                }
            print(f"✅ Ticket {ticket_id} encontrado")
            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(item, cls=DecimalEncoder)
            }
        elif batch_id:
            # Filtrar tickets por batch_id
            print(f"🔍 Buscando tickets del batch: {batch_id}")
            response = tabla.scan(
                FilterExpression=Attr('batch_id').eq(batch_id),
                Limit=100
            )
            items = response.get("Items", [])
            print(f"📊 Encontrados {len(items)} tickets para batch_id={batch_id}")
            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(items, cls=DecimalEncoder)
            }
        else:
            # Obtener todos los tickets
            print("📋 Obteniendo todos los tickets (scan)")
            response = tabla.scan(Limit=100)
            items = response.get("Items", [])
            print(f"📊 Total de tickets obtenidos: {len(items)}")
            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(items, cls=DecimalEncoder)
            }

    except Exception as e:
        print(f"💥 Error en Lector: {str(e)}")
        return {
            "statusCode": 500,
            "headers": headers,
            "body": json.dumps({"error": str(e)})
        }

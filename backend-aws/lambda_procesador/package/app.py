import json
import os
import boto3
from groq import Groq

# Configuración inicial fuera del handler para aprovechar la reutilización de contenedores Lambda
dynamodb = boto3.resource("dynamodb")
# Usaremos la región por defecto de AWS configurada
tabla = dynamodb.Table("Tickets")

# Inicializar cliente Groq
groq_api_key = os.environ.get("GROQ_API_KEY")
groq_client = Groq(api_key=groq_api_key)

def lambda_handler(event, context):
    print("Recibido evento SQS:", json.dumps(event))
    
    for record in event["Records"]:
        # Extraer el body del mensaje de SQS
        try:
            ticket = json.loads(record["body"])
        except json.JSONDecodeError:
            print("Error: El mensaje de SQS no es un JSON válido:", record["body"])
            # Si el formato está mal, lanzamos error para que vaya a la DLQ o lo arreglen
            raise ValueError("Formato de mensaje inválido")
            
        ticket_id = ticket.get("ticket_id")
        texto = ticket.get("texto")
        
        if not ticket_id or not texto:
            print("Error: El ticket no tiene ticket_id o texto.", ticket)
            raise ValueError("Faltan campos obligatorios en el ticket")
            
        print(f"Procesando ticket {ticket_id}...")
        
        try:
            # 1. Actualizar estado a PROCESANDO (Opcional, pero bueno para el frontend si lee directo)
            tabla.update_item(
                Key={"ticket_id": ticket_id},
                UpdateExpression="SET estado = :e",
                ExpressionAttributeValues={":e": "PROCESANDO"}
            )
            
            # 2. Llamada a la IA (Groq)
            resultado = clasificar_con_groq(texto)
            print("Respuesta de Groq:", resultado)
            
            # 3. Guardar el resultado final en DynamoDB
            tabla.update_item(
                Key={"ticket_id": ticket_id},
                UpdateExpression="SET estado = :e, urgencia = :u, tema = :t, departamento = :d, problema_principal = :pp, problemas_asociados = :pa, propuesta_solucion = :ps, solucion_secundaria = :ss",
                ExpressionAttributeValues={
                    ":e": "RESUELTO",
                    ":u": resultado.get("urgencia", "BAJA"),
                    ":t": resultado.get("tema", "General"),
                    ":d": resultado.get("departamento", "Soporte Técnico"),
                    ":pp": resultado.get("problema_principal", "No especificado"),
                    ":pa": resultado.get("problemas_asociados", []),
                    ":ps": resultado.get("propuesta_solucion", "No se pudo generar solución."),
                    ":ss": resultado.get("solucion_secundaria", ""),
                }
            )
            print(f"Ticket {ticket_id} finalizado y guardado con éxito.")
            
        except Exception as e:
            # Capturar errores (incluyendo límites de API de Groq, errores de DB, etc.)
            print(f"ERROR CRÍTICO al procesar el ticket {ticket_id}: {str(e)}")
            
            # Si es un rate limit de Groq, SQS debe reintentar. 
            # Levantamos la excepción para que Lambda marque el mensaje como fallido,
            # y SQS aplique el visibility timeout y lo reintente.
            raise e

def clasificar_con_groq(texto):
    prompt = f"""Eres un agente experto de soporte técnico IT de Nivel 2.
    Tu tarea es leer el problema reportado por el usuario y extraer la información en formato JSON estricto con exactamente estas 7 claves:
    {{
      "urgencia": "ALTA", "MEDIA" o "BAJA",
      "tema": "Categoría general del problema (ej: Conectividad, Hardware)",
      "departamento": "Hardware, Software, Redes, Accesos, o Soporte General",
      "problema_principal": "Resumen conciso del problema central",
      "problemas_asociados": ["Lista", "de", "problemas", "secundarios"],
      "propuesta_solucion": "Solución principal detallada paso a paso",
      "solucion_secundaria": "Alternativa si la primera no funciona"
    }}
    
    Ticket del usuario: "{texto}"
    
    Responde ÚNICAMENTE con el objeto JSON. No añadas introducciones ni saludos.
    """
    
    respuesta = groq_client.chat.completions.create(
        model="llama3-8b-8192",
        messages=[
            {"role": "system", "content": "You are a helpful assistant that always responds in valid JSON."},
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
        max_tokens=500
    )
    
    contenido = respuesta.choices[0].message.content
    return json.loads(contenido)


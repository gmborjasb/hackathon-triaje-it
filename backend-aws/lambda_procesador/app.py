import json
import os
import boto3
import urllib.request
from groq import Groq

# Configuración inicial fuera del handler
dynamodb = boto3.resource("dynamodb")
tabla = dynamodb.Table("Tickets")

groq_api_key = os.environ.get("GROQ_API_KEY")
groq_client = Groq(api_key=groq_api_key)

# Configuración Pinecone
PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY", "pcsk_3Z3p28_PCikS9twvGiejbr8UNLhKQeRz24qrT7cx9jrmyVrHQUxHrAAd1tbWYwQhtLMWwH")
PINECONE_HOST = os.environ.get("PINECONE_HOST", "triaje-tickets-j2i673j.svc.aped-4627-b74a.pinecone.io")

def get_embedding(text):
    url = "https://api.pinecone.io/embed"
    headers = {
        "Api-Key": PINECONE_API_KEY,
        "Content-Type": "application/json",
        "X-Pinecone-API-Version": "2024-07"
    }
    data = {
        "model": "multilingual-e5-large",
        "inputs": [{"text": text}],
        "parameters": {"input_type": "passage", "truncate": "END"}
    }
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode('utf-8'))
            return res['data'][0]['values']
    except Exception as e:
        print(f"Error en get_embedding: {e}")
        return None

def upsert_to_pinecone(ticket_id, text, metadata, embedding):
    url = f"https://{PINECONE_HOST}/vectors/upsert"
    headers = {
        "Api-Key": PINECONE_API_KEY,
        "Content-Type": "application/json"
    }
    data = {
        "vectors": [{
            "id": ticket_id,
            "values": embedding,
            "metadata": metadata
        }]
    }
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode('utf-8'))
            print(f"Pinecone Upserted: {res.get('upsertedCount')} vectors")
    except Exception as e:
        print(f"Error en upsert_to_pinecone: {e}")

def lambda_handler(event, context):
    print("🚀 Recibido evento SQS:", json.dumps(event))
    
    for record in event["Records"]:
        try:
            ticket = json.loads(record["body"])
        except json.JSONDecodeError:
            print("❌ Formato de mensaje SQS inválido, omitiendo record")
            continue
            
        ticket_id = ticket.get("ticket_id")
        texto = ticket.get("texto")
        
        if not ticket_id or not texto:
            print(f"⚠️ Record omitido: faltan campos obligatorios (ticket_id={ticket_id}, texto={'vacío' if not texto else 'presente'})")
            continue
            
        print(f"🔄 Procesando ticket {ticket_id}...")
        
        try:
            # Marcar como PROCESANDO
            tabla.update_item(
                Key={"ticket_id": ticket_id},
                UpdateExpression="SET estado = :e",
                ExpressionAttributeValues={":e": "PROCESANDO"}
            )
            print(f"📝 Ticket {ticket_id} marcado como PROCESANDO")
            
            resultado = clasificar_con_groq(texto)
            print(f"🤖 Respuesta de Groq para {ticket_id}:", resultado)
            
            # Guardar resultado en DynamoDB
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
            print(f"✅ Ticket {ticket_id} RESUELTO y guardado en DynamoDB con éxito")
            
        except Exception as groq_error:
            error_msg = str(groq_error)
            
            # Si es un error 429 Rate Limit, no lo marcamos como ERROR.
            # Lanzamos la excepción para que SQS lo retenga en la cola y lo reintente luego.
            if "429" in error_msg or "rate_limit" in error_msg.lower():
                print(f"⏳ RATE LIMIT detectado para ticket {ticket_id}. Devolviendo a la cola SQS para reintento.")
                # Devolver el ticket a estado PENDIENTE para que se refleje en el dashboard
                try:
                    tabla.update_item(
                        Key={"ticket_id": ticket_id},
                        UpdateExpression="SET estado = :e",
                        ExpressionAttributeValues={":e": "PENDIENTE"}
                    )
                except Exception:
                    pass
                # IMPORTANTE: relanzar el error para que AWS Lambda falle y SQS no borre el mensaje
                raise groq_error
                
            # Si es otro tipo de error (ej. JSON inválido del LLM), sí lo marcamos como ERROR
            print(f"💥 ERROR crítico al procesar ticket {ticket_id} con Groq: {error_msg}")
            try:
                tabla.update_item(
                    Key={"ticket_id": ticket_id},
                    UpdateExpression="SET estado = :e, error_mensaje = :em",
                    ExpressionAttributeValues={
                        ":e": "ERROR",
                        ":em": error_msg
                    }
                )
                print(f"🔴 Ticket {ticket_id} marcado como ERROR en DynamoDB")
            except Exception as db_error:
                print(f"💥💥 No se pudo marcar ticket {ticket_id} como ERROR en DynamoDB: {str(db_error)}")
            # Continuar con el siguiente en el batch si hay más (aunque el batch size es 1)
            continue
        
        # PINECONE: Generar Embedding y Upsert (best-effort, no falla la función)
        try:
            print(f"🧠 Generando Embedding para ticket {ticket_id}...")
            texto_completo = f"Problema Original: {texto}. Problema Principal: {resultado.get('problema_principal')}. Solución Propuesta: {resultado.get('propuesta_solucion')}. Solución Secundaria: {resultado.get('solucion_secundaria')}"
            
            vector = get_embedding(texto_completo)
            if vector:
                metadata = {
                    "ticket_id": ticket_id,
                    "tema": resultado.get("tema", "General"),
                    "texto_original": texto,
                    "propuesta_solucion": resultado.get("propuesta_solucion", "")
                }
                upsert_to_pinecone(ticket_id, texto_completo, metadata, vector)
                print(f"📌 Ticket {ticket_id} indexado en Pinecone correctamente")
            else:
                print(f"⚠️ WARNING: No se generó embedding para ticket {ticket_id}, Pinecone omitido")
        except Exception as pinecone_error:
            # Pinecone es best-effort: loguear pero NO re-raise
            print(f"⚠️ WARNING: Pinecone falló para ticket {ticket_id}: {str(pinecone_error)}")
            print(f"⚠️ El ticket {ticket_id} ya está guardado como RESUELTO en DynamoDB, continuando...")

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
        model="llama-3.1-8b-instant",
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

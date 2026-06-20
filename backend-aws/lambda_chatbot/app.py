import json
import os
import urllib.request
from groq import Groq

groq_api_key = os.environ.get("GROQ_API_KEY")
groq_client = Groq(api_key=groq_api_key)

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
        "parameters": {"input_type": "query", "truncate": "END"}
    }
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res = json.loads(response.read().decode('utf-8'))
            return res['data'][0]['values']
    except Exception as e:
        print(f"Error en get_embedding: {e}")
        return None

def query_pinecone(embedding, top_k=3):
    url = f"https://{PINECONE_HOST}/query"
    headers = {
        "Api-Key": PINECONE_API_KEY,
        "Content-Type": "application/json"
    }
    data = {
        "vector": embedding,
        "topK": top_k,
        "includeMetadata": True
    }
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res = json.loads(response.read().decode('utf-8'))
            return res.get('matches', [])
    except Exception as e:
        print(f"Error en query_pinecone: {e}")
        return []

def lambda_handler(event, context):
    try:
        # Handle CORS preflight OPTIONS request
        if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS' or event.get('httpMethod') == 'OPTIONS':
            return {
                "statusCode": 200,
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Methods": "*"
                },
                "body": ""
            }

        body = json.loads(event.get('body', '{}'))
        query_text = body.get('query', '')
        context_ticket = body.get('contextTicket', None)
        
        if not query_text:
            return {
                "statusCode": 400,
                "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"},
                "body": json.dumps({"error": "Por favor, escribe una consulta antes de enviar."})
            }
        
        if len(query_text) > 500:
            return {
                "statusCode": 400,
                "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"},
                "body": json.dumps({"error": f"La consulta es demasiado larga ({len(query_text)} caracteres). El máximo permitido es 500 caracteres."})
            }
            
        print(f"Buscando RAG para: {query_text}")
        
        # 1. Convertir la pregunta en Vector
        vector = get_embedding(query_text)
        
        # 2. Buscar en Pinecone
        contextos_str = ""
        has_matches = False
        if vector:
            matches = query_pinecone(vector, top_k=3)
            print(f"Encontrados {len(matches)} matches en Pinecone.")
            
            for m in matches:
                meta = m.get('metadata', {})
                contextos_str += f"- Ticket [{meta.get('ticket_id')}]: {meta.get('texto_original')} -> Solución: {meta.get('propuesta_solucion')}\n"
            
            if matches:
                has_matches = True
        
        # 3. Construir el Prompt para Groq
        if has_matches and contextos_str:
            # Hay contexto de tickets anteriores
            prompt_sistema = f"""Eres un asistente técnico de IA. 
Tu objetivo es responder a la pregunta del usuario utilizando ESTRICTAMENTE la base de conocimientos proporcionada a continuación (casos anteriores resueltos). 
Si la respuesta no está en la base de conocimientos, dilo claramente y no inventes soluciones.
Responde de forma clara y directa, utilizando formato Markdown.

BASE DE CONOCIMIENTOS (Tickets Anteriores):
{contextos_str}
"""
        else:
            # Sin matches: generar respuesta amigable sin contexto
            print("⚠️ Sin matches en Pinecone, generando respuesta de conocimiento general")
            prompt_sistema = """Eres un asistente técnico de IA especializado en soporte IT.
No se encontraron tickets similares en el historial de la base de conocimientos.
Responde a la pregunta del usuario con tu conocimiento general de soporte técnico IT.
Sé honesto e indica que no encontraste casos previos similares, pero ofrece orientación útil.
Responde de forma clara y directa, utilizando formato Markdown y en español.
"""

        # Añadir contexto de ticket si existe
        if context_ticket:
            prompt_sistema += f"\n\nATENCIÓN: El usuario está preguntando específicamente sobre el ticket actual #{context_ticket.get('ticket_id')} que trata sobre: '{context_ticket.get('problema_principal')}'. Utiliza la base de conocimientos para ayudar a resolver este ticket actual."

        # 4. Generar respuesta con Groq Llama 3.1
        respuesta_groq = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": prompt_sistema},
                {"role": "user", "content": query_text}
            ],
            temperature=0.3,
            max_tokens=1000
        )
        
        respuesta_final = respuesta_groq.choices[0].message.content
        
        return {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Content-Type": "application/json"},
            "body": json.dumps({"response": respuesta_final})
        }
        
    except json.JSONDecodeError:
        print("❌ Error: JSON inválido en el body de la solicitud")
        return {
            "statusCode": 400,
            "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"},
            "body": json.dumps({"error": "El formato de la solicitud no es válido. Asegúrate de enviar un JSON correcto."})
        }
    except Exception as e:
        print(f"💥 Error interno: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"},
            "body": json.dumps({"error": "Ocurrió un error interno en el servidor. Por favor, inténtalo de nuevo más tarde."})
        }

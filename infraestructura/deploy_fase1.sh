#!/bin/bash
set -e

echo "=================================================="
echo "Iniciando despliegue de Fase 1 (Backend AWS)"
echo "=================================================="

# Verificar clave de GROQ
if [ -z "$1" ]; then
    echo "ERROR: Debes proporcionar la API Key de Groq como argumento."
    echo "Uso: ./deploy_fase1.sh TU_GROQ_API_KEY"
    exit 1
fi
GROQ_API_KEY=$1

export AWS_PAGER=""

echo "1. Creando tabla DynamoDB 'Tickets'..."
aws dynamodb create-table \
    --table-name Tickets \
    --attribute-definitions AttributeName=ticket_id,AttributeType=S \
    --key-schema AttributeName=ticket_id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST > /dev/null 2>&1 || echo "La tabla ya existe, omitiendo..."

echo "2. Creando colas SQS..."
DLQ_URL=$(aws sqs create-queue --queue-name tickets-dlq --output text --query 'QueueUrl')
DLQ_ARN=$(aws sqs get-queue-attributes --queue-url $DLQ_URL --attribute-names QueueArn --output text --query 'Attributes.QueueArn')

# Redrive policy para enviar a la DLQ después de 3 intentos
REDRIVE_POLICY="{\"deadLetterTargetArn\":\"$DLQ_ARN\",\"maxReceiveCount\":\"3\"}"

QUEUE_URL=$(aws sqs create-queue --queue-name tickets-queue --attributes RedrivePolicy="\\\"$REDRIVE_POLICY\\\"" --output text --query 'QueueUrl' 2>/dev/null || aws sqs create-queue --queue-name tickets-queue --output text --query 'QueueUrl')
QUEUE_ARN=$(aws sqs get-queue-attributes --queue-url $QUEUE_URL --attribute-names QueueArn --output text --query 'Attributes.QueueArn')

echo "Cola principal ARN: $QUEUE_ARN"

echo "3. Configurando IAM Role para Lambda..."
# En AWS Academy no podemos crear roles, usamos el LabRole preexistente
ROLE_ARN=$(aws iam get-role --role-name LabRole --output text --query 'Role.Arn')
echo "Usando LabRole: $ROLE_ARN"


echo "4. Empaquetando código de la función Lambda..."
cd ../backend-aws/lambda_procesador

# Eliminar zip anterior si existe
rm -rf package function.zip
mkdir package

# Instalar dependencias en la carpeta package
pip3 install -r requirements.txt --target ./package

# Copiar el código fuente
cp app.py ./package/

# Crear archivo ZIP
cd package
zip -r ../function.zip . > /dev/null
cd ..

echo "5. Desplegando Lambda 'ProcesarTicketGroq'..."
# Crear función o actualizar si ya existe
aws lambda create-function \
    --function-name ProcesarTicketGroq \
    --runtime python3.9 \
    --role $ROLE_ARN \
    --handler app.lambda_handler \
    --timeout 30 \
    --zip-file fileb://function.zip \
    --environment "Variables={GROQ_API_KEY=$GROQ_API_KEY}" > /dev/null 2>&1 || \
aws lambda update-function-code \
    --function-name ProcesarTicketGroq \
    --zip-file fileb://function.zip > /dev/null

# Actualizar variables de entorno por si era una actualización
aws lambda update-function-configuration \
    --function-name ProcesarTicketGroq \
    --environment "Variables={GROQ_API_KEY=$GROQ_API_KEY}" > /dev/null

echo "6. Conectando SQS con Lambda..."
aws lambda create-event-source-mapping \
    --function-name ProcesarTicketGroq \
    --batch-size 5 \
    --event-source-arn $QUEUE_ARN > /dev/null 2>&1 || echo "El mapeo de eventos ya existe."

# Limpieza temporal
rm trust-policy.json 2>/dev/null || true
rm -rf package function.zip

echo "=================================================="
echo "✅ Despliegue completado con éxito."
echo "La infraestructura backend está lista en AWS."
echo "URL de la cola SQS para enviar mensajes:"
echo "$QUEUE_URL"
echo "=================================================="

#!/bin/bash
set -e

echo "=================================================="
echo "Iniciando despliegue de Fase 2 (Despachador y Lector)"
echo "=================================================="

export AWS_PAGER=""

echo "1. Obteniendo recursos existentes..."
ROLE_ARN=$(aws iam get-role --role-name LabRole --output text --query 'Role.Arn')
QUEUE_URL=$(aws sqs get-queue-url --queue-name tickets-queue --output text --query 'QueueUrl')
echo "Usando LabRole: $ROLE_ARN"
echo "Usando SQS: $QUEUE_URL"

echo "2. Empaquetando y Desplegando Lambda 'LectorTickets'..."
cd ../backend-aws/lambda_lector
rm -rf function.zip
zip function.zip app.py > /dev/null

aws lambda create-function \
    --function-name LectorTickets \
    --runtime python3.9 \
    --role $ROLE_ARN \
    --handler app.lambda_handler \
    --zip-file fileb://function.zip > /dev/null 2>&1 || \
aws lambda update-function-code \
    --function-name LectorTickets \
    --zip-file fileb://function.zip > /dev/null

echo "Configurando Function URL para LectorTickets..."
aws lambda create-function-url-config \
    --function-name LectorTickets \
    --auth-type NONE \
    --cors '{"AllowOrigins": ["*"], "AllowMethods": ["*"], "AllowHeaders": ["*"]}' > /dev/null 2>&1 || true

aws lambda add-permission \
    --function-name LectorTickets \
    --action lambda:InvokeFunctionUrl \
    --principal "*" \
    --statement-id FunctionURLAllowPublicAccess \
    --function-url-auth-type NONE > /dev/null 2>&1 || true

LECTOR_URL=$(aws lambda get-function-url-config --function-name LectorTickets --output text --query 'FunctionUrl')
echo "✅ URL Lector: $LECTOR_URL"


echo "3. Empaquetando y Desplegando Lambda 'DispatcherTickets'..."
cd ../lambda_dispatcher
rm -rf function.zip
zip function.zip app.py > /dev/null

aws lambda create-function \
    --function-name DispatcherTickets \
    --runtime python3.9 \
    --role $ROLE_ARN \
    --handler app.lambda_handler \
    --environment "Variables={SQS_QUEUE_URL=$QUEUE_URL}" \
    --zip-file fileb://function.zip > /dev/null 2>&1 || \
aws lambda update-function-code \
    --function-name DispatcherTickets \
    --zip-file fileb://function.zip > /dev/null

sleep 10

aws lambda update-function-configuration \
    --function-name DispatcherTickets \
    --environment "Variables={SQS_QUEUE_URL=$QUEUE_URL}" > /dev/null

echo "Configurando Function URL para DispatcherTickets..."
aws lambda create-function-url-config \
    --function-name DispatcherTickets \
    --auth-type NONE \
    --cors '{"AllowOrigins": ["*"], "AllowMethods": ["*"], "AllowHeaders": ["*"]}' > /dev/null 2>&1 || true

aws lambda add-permission \
    --function-name DispatcherTickets \
    --action lambda:InvokeFunctionUrl \
    --principal "*" \
    --statement-id FunctionURLAllowPublicAccess \
    --function-url-auth-type NONE > /dev/null 2>&1 || true

DISPATCHER_URL=$(aws lambda get-function-url-config --function-name DispatcherTickets --output text --query 'FunctionUrl')
echo "✅ URL Dispatcher: $DISPATCHER_URL"

echo "4. Actualizando código de Lambda procesador (ProcesarTicketGroq)..."
cd ../lambda_procesador
# Empaquetamos el app.py nuevo
rm -rf package function.zip
mkdir package
cp app.py ./package/
# Usamos pip3 y python3 dependiendo del SO
if command -v pip3 &> /dev/null; then
    pip3 install groq -t ./package > /dev/null
else
    pip install groq -t ./package > /dev/null
fi
cd package
zip -r ../function.zip . > /dev/null
cd ..

aws lambda update-function-code \
    --function-name ProcesarTicketGroq \
    --zip-file fileb://function.zip > /dev/null

echo "=================================================="
echo "🚀 ¡Despliegue de Fase 2 completado!"
echo "Usa estas URLs en tu frontend (.env):"
echo "VITE_API_URL_READ=$LECTOR_URL"
echo "VITE_API_URL_WRITE=$DISPATCHER_URL"
echo "=================================================="

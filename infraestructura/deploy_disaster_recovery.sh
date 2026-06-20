#!/bin/bash
set -e
export AWS_PAGER=""

echo "=================================================="
echo "Iniciando Disaster Recovery (Redespliegue AWS)"
echo "=================================================="

echo "=== 1. Obteniendo Role ARN ==="
ROLE_ARN=$(aws iam get-role --role-name LabRole --output text --query 'Role.Arn')
echo "Role: $ROLE_ARN"

echo "=== 2. Creando DynamoDB ==="
aws dynamodb create-table --table-name Tickets --attribute-definitions AttributeName=ticket_id,AttributeType=S --key-schema AttributeName=ticket_id,KeyType=HASH --billing-mode PAY_PER_REQUEST > /dev/null 2>&1 || echo "Tabla Tickets ya existe"

echo "=== 3. Creando SQS ==="
DLQ_URL=$(aws sqs create-queue --queue-name tickets-dlq --output text --query 'QueueUrl')
DLQ_ARN=$(aws sqs get-queue-attributes --queue-url $DLQ_URL --attribute-names QueueArn --output text --query 'Attributes.QueueArn')
REDRIVE_POLICY="{\"deadLetterTargetArn\":\"$DLQ_ARN\",\"maxReceiveCount\":\"3\"}"
QUEUE_URL=$(aws sqs create-queue --queue-name tickets-queue --attributes RedrivePolicy="\\\"$REDRIVE_POLICY\\\"" --output text --query 'QueueUrl' 2>/dev/null || aws sqs create-queue --queue-name tickets-queue --output text --query 'QueueUrl')
QUEUE_ARN=$(aws sqs get-queue-attributes --queue-url $QUEUE_URL --attribute-names QueueArn --output text --query 'Attributes.QueueArn')
echo "SQS Queue ARN: $QUEUE_ARN"

echo "=== 4. Desplegando Lambda LectorTickets ==="
cd backend-aws/lambda_lector
rm -f function.zip
zip function.zip app.py > /dev/null
aws lambda create-function --function-name LectorTickets --runtime python3.9 --role $ROLE_ARN --handler app.lambda_handler --zip-file fileb://function.zip > /dev/null 2>&1 || aws lambda update-function-code --function-name LectorTickets --zip-file fileb://function.zip > /dev/null
aws lambda create-function-url-config --function-name LectorTickets --auth-type NONE --cors '{"AllowOrigins": ["*"], "AllowMethods": ["*"], "AllowHeaders": ["*"]}' > /dev/null 2>&1 || true
aws lambda add-permission --function-name LectorTickets --action lambda:InvokeFunctionUrl --principal "*" --statement-id FunctionURLAllowPublicAccess --function-url-auth-type NONE > /dev/null 2>&1 || true
LECTOR_URL=$(aws lambda get-function-url-config --function-name LectorTickets --output text --query 'FunctionUrl')
echo "URL Lector: $LECTOR_URL"

echo "=== 5. Desplegando Lambda DispatcherTickets ==="
cd ../lambda_dispatcher
rm -f function.zip
zip function.zip app.py > /dev/null
aws lambda create-function --function-name DispatcherTickets --runtime python3.9 --role $ROLE_ARN --handler app.lambda_handler --environment "Variables={SQS_QUEUE_URL=$QUEUE_URL}" --zip-file fileb://function.zip > /dev/null 2>&1 || aws lambda update-function-code --function-name DispatcherTickets --zip-file fileb://function.zip > /dev/null
sleep 5
aws lambda update-function-configuration --function-name DispatcherTickets --environment "Variables={SQS_QUEUE_URL=$QUEUE_URL}" > /dev/null
aws lambda create-function-url-config --function-name DispatcherTickets --auth-type NONE --cors '{"AllowOrigins": ["*"], "AllowMethods": ["*"], "AllowHeaders": ["*"]}' > /dev/null 2>&1 || true
aws lambda add-permission --function-name DispatcherTickets --action lambda:InvokeFunctionUrl --principal "*" --statement-id FunctionURLAllowPublicAccess --function-url-auth-type NONE > /dev/null 2>&1 || true
DISPATCHER_URL=$(aws lambda get-function-url-config --function-name DispatcherTickets --output text --query 'FunctionUrl')
echo "URL Dispatcher: $DISPATCHER_URL"

echo "=== 6. Desplegando Lambda ChatbotRAG ==="
cd ../lambda_chatbot
rm -f function.zip
zip -r function.zip . > /dev/null
aws lambda create-function --function-name ChatbotRAG --runtime python3.9 --role $ROLE_ARN --handler app.lambda_handler --timeout 30 --zip-file fileb://function.zip --environment "Variables={GROQ_API_KEY=$GROQ_API_KEY,PINECONE_API_KEY=$PINECONE_API_KEY,PINECONE_HOST=triaje-tickets-j2i673j.svc.aped-4627-b74a.pinecone.io}" > /dev/null 2>&1 || aws lambda update-function-code --function-name ChatbotRAG --zip-file fileb://function.zip > /dev/null
sleep 5
aws lambda update-function-configuration --function-name ChatbotRAG --environment "Variables={GROQ_API_KEY=$GROQ_API_KEY,PINECONE_API_KEY=$PINECONE_API_KEY,PINECONE_HOST=triaje-tickets-j2i673j.svc.aped-4627-b74a.pinecone.io}" > /dev/null
aws lambda create-function-url-config --function-name ChatbotRAG --auth-type NONE --cors '{"AllowOrigins": ["*"], "AllowMethods": ["*"], "AllowHeaders": ["*"]}' > /dev/null 2>&1 || true
aws lambda add-permission --function-name ChatbotRAG --action lambda:InvokeFunctionUrl --principal "*" --statement-id FunctionURLAllowPublicAccess --function-url-auth-type NONE > /dev/null 2>&1 || true
CHATBOT_URL=$(aws lambda get-function-url-config --function-name ChatbotRAG --output text --query 'FunctionUrl')
echo "URL Chatbot: $CHATBOT_URL"

echo "=== 7. Desplegando Lambda ProcesarTicketGroq ==="
cd ../lambda_procesador
rm -f function.zip
zip -r function.zip . > /dev/null
aws lambda create-function --function-name ProcesarTicketGroq --runtime python3.9 --role $ROLE_ARN --handler app.lambda_handler --timeout 30 --zip-file fileb://function.zip --environment "Variables={GROQ_API_KEY=$GROQ_API_KEY,PINECONE_API_KEY=$PINECONE_API_KEY,PINECONE_HOST=triaje-tickets-j2i673j.svc.aped-4627-b74a.pinecone.io}" > /dev/null 2>&1 || aws lambda update-function-code --function-name ProcesarTicketGroq --zip-file fileb://function.zip > /dev/null
sleep 5
aws lambda update-function-configuration --function-name ProcesarTicketGroq --environment "Variables={GROQ_API_KEY=$GROQ_API_KEY,PINECONE_API_KEY=$PINECONE_API_KEY,PINECONE_HOST=triaje-tickets-j2i673j.svc.aped-4627-b74a.pinecone.io}" > /dev/null
aws lambda put-function-concurrency --function-name ProcesarTicketGroq --reserved-concurrent-executions 3 > /dev/null || true
aws lambda create-event-source-mapping --function-name ProcesarTicketGroq --batch-size 1 --event-source-arn $QUEUE_ARN > /dev/null 2>&1 || true

echo "=== 8. Actualizando Frontend .env ==="
cd ../../frontend
echo "VITE_API_URL_READ=$LECTOR_URL" > .env
echo "VITE_API_URL_WRITE=$DISPATCHER_URL" >> .env
echo "VITE_API_URL_CHATBOT=$CHATBOT_URL" >> .env
echo ".env actualizado correctamente!"

echo "=================================================="
echo "Backend Completado. Procediendo a compilar y actualizar Frontend..."
echo "=================================================="

cd ..
python3 infraestructura/update_amplify.py

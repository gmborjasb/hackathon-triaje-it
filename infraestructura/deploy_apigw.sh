#!/bin/bash
set -e
export AWS_PAGER=""

API_ID="d8ali1wk47"
ACCOUNT_ID="488328690387"

# 1. Crear Integrations
INT_LECTOR=$(aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri arn:aws:lambda:us-east-1:$ACCOUNT_ID:function:LectorTickets --payload-format-version 2.0 --output text --query 'IntegrationId')
INT_DISPATCHER=$(aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri arn:aws:lambda:us-east-1:$ACCOUNT_ID:function:DispatcherTickets --payload-format-version 2.0 --output text --query 'IntegrationId')
INT_CHATBOT=$(aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri arn:aws:lambda:us-east-1:$ACCOUNT_ID:function:ChatbotRAG --payload-format-version 2.0 --output text --query 'IntegrationId')

# 2. Crear Routes
aws apigatewayv2 create-route --api-id $API_ID --route-key "ANY /tickets" --target "integrations/$INT_LECTOR" > /dev/null
aws apigatewayv2 create-route --api-id $API_ID --route-key "ANY /upload" --target "integrations/$INT_DISPATCHER" > /dev/null
aws apigatewayv2 create-route --api-id $API_ID --route-key "ANY /query" --target "integrations/$INT_CHATBOT" > /dev/null

# 3. Permisos de Lambda
aws lambda add-permission --function-name LectorTickets --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:us-east-1:$ACCOUNT_ID:$API_ID/*/*" --statement-id apigw-lector 2>/dev/null || true
aws lambda add-permission --function-name DispatcherTickets --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:us-east-1:$ACCOUNT_ID:$API_ID/*/*" --statement-id apigw-dispatcher 2>/dev/null || true
aws lambda add-permission --function-name ChatbotRAG --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:us-east-1:$ACCOUNT_ID:$API_ID/*/*" --statement-id apigw-chatbot 2>/dev/null || true

# 4. Crear Stage $default
aws apigatewayv2 create-stage --api-id $API_ID --stage-name '$default' --auto-deploy > /dev/null 2>&1 || true

API_URL="https://${API_ID}.execute-api.us-east-1.amazonaws.com"
echo "API Gateway URL: $API_URL"

# 5. Actualizar Frontend .env
cd frontend
echo "VITE_API_URL_READ=${API_URL}/tickets" > .env
echo "VITE_API_URL_WRITE=${API_URL}/upload" >> .env
echo "VITE_API_URL_CHATBOT=${API_URL}/query" >> .env
cd ..

# 6. Desplegar
python3 infraestructura/update_amplify.py

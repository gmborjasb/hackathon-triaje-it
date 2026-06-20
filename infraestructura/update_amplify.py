import os
import json
import subprocess
import urllib.request

# Este es el ID fijo de tu aplicación en AWS Amplify
APP_ID = "d1mpo4s6w2qjvd"
BRANCH_NAME = "main"

def run(cmd, shell=True, cwd=None):
    res = subprocess.run(cmd, shell=shell, cwd=cwd, text=True, capture_output=True)
    if res.returncode != 0:
        print(f"Error ejecutando {cmd}: {res.stderr}")
        exit(1)
    return res.stdout

frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

print("1. Construyendo el frontend (npm run build)...")
run("npm run build", cwd=frontend_dir)

print("2. Empaquetando archivos (creando frontend.zip)...")
run("cd dist && zip -r ../frontend.zip *", cwd=frontend_dir)

print("3. Solicitando URL de despliegue a AWS Amplify...")
deploy_info_str = run(f"aws amplify create-deployment --app-id {APP_ID} --branch-name {BRANCH_NAME}")
deploy_info = json.loads(deploy_info_str)
job_id = deploy_info['jobId']
upload_url = deploy_info['zipUploadUrl']

print("4. Subiendo código actualizado a AWS...")
zip_path = os.path.join(frontend_dir, "frontend.zip")
with open(zip_path, 'rb') as f:
    zip_data = f.read()

req = urllib.request.Request(upload_url, data=zip_data, method='PUT')
req.add_header('Content-Type', 'application/zip')
with urllib.request.urlopen(req) as response:
    if response.status == 200:
        print("   ✅ Archivos subidos con éxito.")

print("5. Iniciando el proceso de actualización en la nube...")
run(f"aws amplify start-deployment --app-id {APP_ID} --branch-name {BRANCH_NAME} --job-id {job_id}")

print(f"\n🚀 ¡Actualización en proceso! En un par de minutos estará visible en:")
print(f"👉 https://{BRANCH_NAME}.{APP_ID}.amplifyapp.com")

import os
import json
import subprocess
import urllib.request
import time

def run(cmd, shell=True, cwd=None):
    res = subprocess.run(cmd, shell=shell, cwd=cwd, text=True, capture_output=True)
    if res.returncode != 0:
        print(f"Error running {cmd}: {res.stderr}")
        exit(1)
    return res.stdout

frontend_dir = "/Users/gmborjasb/Desktop/VScode/CLOUD/hackathon-triaje-it/frontend"

# 1. Build and Zip
print("Building frontend...")
run("npm run build", cwd=frontend_dir)

print("Zipping frontend...")
# We must zip the CONTENTS of dist, not the dist folder itself
run("cd dist && zip -r ../frontend.zip *", cwd=frontend_dir)

# 2. Create Amplify App
print("Creating Amplify App...")
rules = [
    {
        "source": "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>",
        "target": "/index.html",
        "status": "200"
    }
]
cmd_app = f"aws amplify create-app --name Triaje-IT-Frontend --custom-rules '{json.dumps(rules)}'"
app_info_str = run(cmd_app)
app_info = json.loads(app_info_str)
app_id = app_info['app']['appId']
print(f"Created App ID: {app_id}")

# 3. Create Branch
print("Creating Branch 'main'...")
run(f"aws amplify create-branch --app-id {app_id} --branch-name main")

# 4. Create Deployment
print("Creating Deployment...")
deploy_info_str = run(f"aws amplify create-deployment --app-id {app_id} --branch-name main")
deploy_info = json.loads(deploy_info_str)
job_id = deploy_info['jobId']
upload_url = deploy_info['zipUploadUrl']

# 5. Upload ZIP
print("Uploading ZIP to Amplify...")
zip_path = os.path.join(frontend_dir, "frontend.zip")
with open(zip_path, 'rb') as f:
    zip_data = f.read()

req = urllib.request.Request(upload_url, data=zip_data, method='PUT')
req.add_header('Content-Type', 'application/zip')
with urllib.request.urlopen(req) as response:
    print(f"Upload Status: {response.status}")

# 6. Start Deployment
print("Starting Deployment Job...")
run(f"aws amplify start-deployment --app-id {app_id} --branch-name main --job-id {job_id}")

print(f"Deployment started! URL will be: https://main.{app_id}.amplifyapp.com")

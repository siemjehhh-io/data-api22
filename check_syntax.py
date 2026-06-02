import os
import subprocess

workspace_dir = r"d:\DATA WEB PIN88"
index_path = os.path.join(workspace_dir, "google_apps_script_single_sheets", "Index.html")

with open(index_path, "r", encoding="utf-8") as f:
    content = f.read()

# Find all script blocks
import re
scripts = re.findall(r'<script[^>]*>([\s\S]*?)</script>', content)

print(f"Found {len(scripts)} script blocks.")

# We want to check each script block
for i, script in enumerate(scripts):
    temp_file = os.path.join(workspace_dir, f"temp_script_{i}.js")
    with open(temp_file, "w", encoding="utf-8") as f:
        f.write(script)
    
    # Run node --check
    res = subprocess.run(["node", "--check", temp_file], capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Script block {i} has syntax errors:")
        print(res.stderr)
    else:
        print(f"Script block {i} is syntax valid.")
        
    # Clean up
    if os.path.exists(temp_file):
        os.remove(temp_file)

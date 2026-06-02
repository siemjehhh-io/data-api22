import os
import re

workspace_dir = r"d:\DATA WEB PIN88"
gas_dir = os.path.join(workspace_dir, "google_apps_script")
file_path = os.path.join(gas_dir, "App_GAS.html")

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

def transpile_template_literal(match):
    inner = match.group(1)
    
    # Split by ${...} pattern
    # The pattern matches ${ followed by anything non-greedy, followed by }
    parts = re.split(r'(\$\{[\s\S]*?\})', inner)
    
    transpiled_parts = []
    for i, part in enumerate(parts):
        if i % 2 == 0:
            # Static text block: Escape single quotes and newlines
            part = part.replace("'", "\\'").replace("\r", "").replace("\n", "\\n")
            transpiled_parts.append("'" + part + "'")
        else:
            # Expression block: ${expression}
            # Extract expression inside ${...}
            expr = part[2:-1]
            transpiled_parts.append("(" + expr + ")")
            
    # Join the parts with " + "
    return " + ".join(transpiled_parts)

# We match any backtick block `...`
transpiled_content = re.sub(r'`([\s\S]*?)`', transpile_template_literal, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(transpiled_content)

print("App_GAS.html transpiled successfully to remove all backticks!")

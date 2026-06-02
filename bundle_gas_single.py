import os
import re

workspace_dir = r"d:\DATA WEB PIN88"
gas_dir = os.path.join(workspace_dir, "google_apps_script")
output_dir = os.path.join(workspace_dir, "google_apps_script_single_sheets")

if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# Read the files
with open(os.path.join(gas_dir, "Index.html"), "r", encoding="utf-8") as f:
    index_content = f.read()

with open(os.path.join(gas_dir, "Style.html"), "r", encoding="utf-8") as f:
    style_content = f.read()

with open(os.path.join(gas_dir, "CryptoJS.html"), "r", encoding="utf-8") as f:
    cryptojs_content = f.read()

with open(os.path.join(gas_dir, "App_GAS.html"), "r", encoding="utf-8") as f:
    app_gas_content = f.read()

# Replace include tags
# Note: we need to strip any script/style tags if we are wrapping them, or we can just replace the include tag directly since the source files already contain <style> and <script> tags!
# Let's check:
# Style.html starts with <style> and ends with </style>
# CryptoJS.html starts with <script> and ends with </script>
# App_GAS.html starts with <script> and ends with </script>
# So we can just drop them in directly!

index_content = index_content.replace("<?!= include('Style'); ?>", style_content)
index_content = index_content.replace("<?!= include('CryptoJS'); ?>", cryptojs_content)
index_content = index_content.replace("<?!= include('App_GAS'); ?>", app_gas_content)

# Remove the diagnostic verification check since it is no longer needed (App_GAS is now inline)
index_content = re.sub(
    r"<!-- ✅ VERIFIKASI — cek apakah App_GAS berhasil load -->\s*<script>[\s\S]*?</script>",
    "",
    index_content
)

# Write output Index.html
with open(os.path.join(output_dir, "Index.html"), "w", encoding="utf-8") as f:
    f.write(index_content)

# Copy Code.gs to output_dir
with open(os.path.join(gas_dir, "Code.gs"), "r", encoding="utf-8") as f:
    code_gs_content = f.read()

# Remove the debugAppGas function from Code.gs to keep it clean, or keep it. Let's keep it just in case.
with open(os.path.join(output_dir, "Code.gs"), "w", encoding="utf-8") as f:
    f.write(code_gs_content)

print("GAS Unified Single-File Sheets version built successfully in: " + output_dir)

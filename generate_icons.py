import os
from PIL import Image

def resize_icon(source_path, size, output_path):
    try:
        img = Image.open(source_path)
        # Resize using LANCZOS for best quality
        img = img.resize((size, size), Image.Resampling.LANCZOS)
        img.save(output_path)
        print(f"Created {output_path}")
    except Exception as e:
        print(f"Error creating {output_path}: {e}")

icon_dir = '/Users/localuser/Documents/OpenSource/translate-extension/icons'
# Use the exact path returned by the generate_image tool
source_icon = '/Users/localuser/.gemini/antigravity/brain/1bc2f01b-5efa-4e44-9fd9-600437e09ab2/icon_master_v3_1764836440533.png'

if not os.path.exists(icon_dir):
    os.makedirs(icon_dir)

if os.path.exists(source_icon):
    resize_icon(source_icon, 16, os.path.join(icon_dir, 'icon16.png'))
    resize_icon(source_icon, 48, os.path.join(icon_dir, 'icon48.png'))
    resize_icon(source_icon, 128, os.path.join(icon_dir, 'icon128.png'))
else:
    print(f"Source icon not found at {source_icon}")

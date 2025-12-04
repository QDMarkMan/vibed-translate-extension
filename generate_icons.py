import os
from PIL import Image, ImageDraw

def create_icon(size, filename):
    # Premium Blue Theme
    bg_color = (37, 99, 235) # #2563eb
    icon_color = (255, 255, 255) # White
    
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw rounded square background
    # Radius approx 20% of size
    radius = size // 5
    draw.rounded_rectangle([0, 0, size, size], radius=radius, fill=bg_color)
    
    # SVG Coordinate System is 24x24
    # We want to center this in the icon
    # Let's say the icon content takes up 60% of the width
    scale = (size * 0.6) / 24
    
    # Center offset
    # The SVG content is roughly centered in 24x24, but let's calculate offset
    # 24 * scale is the drawn size
    offset_x = (size - (24 * scale)) / 2
    offset_y = (size - (24 * scale)) / 2
    
    # Helper to transform coordinates
    def t(x, y):
        return (offset_x + x * scale, offset_y + y * scale)
    
    # Stroke width
    width = max(1, int(2 * scale))
    
    # Draw Paths based on SVG d attributes
    # <path d="m5 8 6 6"/> -> (5,8) to (11,14)
    draw.line([t(5, 8), t(11, 14)], fill=icon_color, width=width, joint='curve')
    
    # <path d="m4 14 6-6 2-3"/> -> (4,14) to (10,8) to (12,5)
    draw.line([t(4, 14), t(10, 8), t(12, 5)], fill=icon_color, width=width, joint='curve')
    
    # <path d="M2 5h12"/> -> (2,5) to (14,5)
    draw.line([t(2, 5), t(14, 5)], fill=icon_color, width=width, joint='curve')
    
    # <path d="M7 2h1"/> -> (7,2) to (8,2)
    draw.line([t(7, 2), t(8, 2)], fill=icon_color, width=width, joint='curve')
    
    # <path d="m22 22-5-10-5 10"/> -> (22,22) to (17,12) to (12,22)
    draw.line([t(22, 22), t(17, 12), t(12, 22)], fill=icon_color, width=width, joint='curve')
    
    # <path d="M14 18h6"/> -> (14,18) to (20,18)
    draw.line([t(14, 18), t(20, 18)], fill=icon_color, width=width, joint='curve')

    img.save(filename)
    print(f"Created {filename}")

icon_dir = '/Users/localuser/Documents/OpenSource/translate-extension/icons'
if not os.path.exists(icon_dir):
    os.makedirs(icon_dir)

create_icon(16, os.path.join(icon_dir, 'icon16.png'))
create_icon(48, os.path.join(icon_dir, 'icon48.png'))
create_icon(128, os.path.join(icon_dir, 'icon128.png'))

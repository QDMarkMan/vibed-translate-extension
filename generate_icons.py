import os
from PIL import Image, ImageDraw

def create_gradient(width, height, start_color, end_color):
    base = Image.new('RGBA', (width, height), start_color)
    top = Image.new('RGBA', (width, height), end_color)
    mask = Image.new('L', (width, height))
    mask_data = []
    for y in range(height):
        for x in range(width):
            # Diagonal gradient
            p = (x + y) / (width + height)
            mask_data.append(int(255 * p))
    mask.putdata(mask_data)
    base.paste(top, (0, 0), mask)
    return base

def create_icon(size, filename):
    # Premium Blue Gradient
    color_start = (59, 130, 246) # Blue 500 #3b82f6
    color_end = (29, 78, 216)   # Blue 700 #1d4ed8
    icon_color = (255, 255, 255) # White
    
    # Create main image
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    
    # 1. Draw Gradient Background with Rounded Corners
    # Create a gradient image
    gradient = create_gradient(size, size, color_start, color_end)
    
    # Create a mask for rounded corners
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    radius = size // 5
    mask_draw.rounded_rectangle([0, 0, size, size], radius=radius, fill=255)
    
    # Composite gradient onto transparent background using mask
    img.paste(gradient, (0, 0), mask)
    
    draw = ImageDraw.Draw(img)
    
    # 2. Draw Translation Icon
    # SVG Coordinate System is 24x24
    scale = (size * 0.55) / 24 # Slightly smaller to make room for sparkle
    
    # Center offset - shifted slightly left/down to balance sparkle
    offset_x = (size - (24 * scale)) / 2 - (size * 0.05)
    offset_y = (size - (24 * scale)) / 2 + (size * 0.05)
    
    def t(x, y):
        return (offset_x + x * scale, offset_y + y * scale)
    
    width = max(1, int(2 * scale))
    
    # Draw Paths
    draw.line([t(5, 8), t(11, 14)], fill=icon_color, width=width, joint='curve')
    draw.line([t(4, 14), t(10, 8), t(12, 5)], fill=icon_color, width=width, joint='curve')
    draw.line([t(2, 5), t(14, 5)], fill=icon_color, width=width, joint='curve')
    draw.line([t(7, 2), t(8, 2)], fill=icon_color, width=width, joint='curve')
    draw.line([t(22, 22), t(17, 12), t(12, 22)], fill=icon_color, width=width, joint='curve')
    draw.line([t(14, 18), t(20, 18)], fill=icon_color, width=width, joint='curve')

    # 3. Draw AI Sparkle (Top Right)
    # Center of sparkle
    sx = size * 0.75
    sy = size * 0.25
    sr = size * 0.12 # Radius of sparkle
    
    # 4-pointed star
    sparkle_points = [
        (sx, sy - sr), # Top
        (sx + sr * 0.25, sy - sr * 0.25), # Inner TR
        (sx + sr, sy), # Right
        (sx + sr * 0.25, sy + sr * 0.25), # Inner BR
        (sx, sy + sr), # Bottom
        (sx - sr * 0.25, sy + sr * 0.25), # Inner BL
        (sx - sr, sy), # Left
        (sx - sr * 0.25, sy - sr * 0.25)  # Inner TL
    ]
    draw.polygon(sparkle_points, fill=icon_color)
    
    # Add a smaller sparkle nearby for effect
    sx2 = size * 0.85
    sy2 = size * 0.15
    sr2 = size * 0.06
    sparkle_points2 = [
        (sx2, sy2 - sr2), (sx2 + sr2 * 0.3, sy2 - sr2 * 0.3),
        (sx2 + sr2, sy2), (sx2 + sr2 * 0.3, sy2 + sr2 * 0.3),
        (sx2, sy2 + sr2), (sx2 - sr2 * 0.3, sy2 + sr2 * 0.3),
        (sx2 - sr2, sy2), (sx2 - sr2 * 0.3, sy2 - sr2 * 0.3)
    ]
    draw.polygon(sparkle_points2, fill=icon_color)

    img.save(filename)
    print(f"Created {filename}")

icon_dir = '/Users/localuser/Documents/OpenSource/translate-extension/icons'
if not os.path.exists(icon_dir):
    os.makedirs(icon_dir)

create_icon(16, os.path.join(icon_dir, 'icon16.png'))
create_icon(48, os.path.join(icon_dir, 'icon48.png'))
create_icon(128, os.path.join(icon_dir, 'icon128.png'))

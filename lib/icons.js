// Generate simple colored icons for PWA
export const generateIcon = (size, color = '#3B82F6') => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = size;
  canvas.height = size;
  
  // Background
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  
  // Letter T
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${size * 0.6}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('T', size / 2, size / 2);
  
  return canvas.toDataURL();
};

// Generate all icon sizes
export const generateAllIcons = () => {
  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
  const icons = {};
  
  sizes.forEach(size => {
    icons[`icon-${size}x${size}`] = generateIcon(size);
  });
  
  return icons;
};

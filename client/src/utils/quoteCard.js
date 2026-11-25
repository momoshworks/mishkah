function wrapArabicLines(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    const testLine = current ? `${current} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth) {
      current = testLine;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Render an ornate Mishkah quote card PNG data URL on an HTML5 Canvas.
 * @param {{ badge: string, quote: string, footer: string, subtitle?: string }} opts
 * @returns {string}
 */
export function generateQuoteCardDataUrl({ badge, quote, footer, subtitle = '' }) {
  const width = 1080;
  const height = 720;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Deep emerald & night slate gradient
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#071115');
  grad.addColorStop(0.5, '#0c231f');
  grad.addColorStop(1, '#08141a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Radial glow
  const glow = ctx.createRadialGradient(width * 0.5, height * 0.35, 20, width * 0.5, height * 0.35, 420);
  glow.addColorStop(0, 'rgba(229, 190, 103, 0.16)');
  glow.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Ornate border
  ctx.strokeStyle = 'rgba(229, 190, 103, 0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(32, 32, width - 64, height - 64);

  ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(46, 46, width - 92, height - 92);

  // Brand header
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e5be67';
  ctx.font = 'bold 34px "Amiri", Georgia, serif';
  ctx.fillText('۞  مِشكاة  ۞', width / 2, 105);

  // Badge pill text
  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 22px "Cairo", Tahoma, sans-serif';
  ctx.fillText(badge || 'إشراقة روحانية', width / 2, 152);

  // Main quote lines
  ctx.fillStyle = '#fbf7ec';
  const quoteFontSize = quote.length > 180 ? 32 : 38;
  ctx.font = `bold ${quoteFontSize}px "Amiri", Georgia, serif`;
  const lines = wrapArabicLines(ctx, `«${quote}»`, width - 190).slice(0, 8);
  const lineHeight = quoteFontSize * 1.65;
  const totalHeight = lines.length * lineHeight;
  let y = Math.max(225, (height - totalHeight) / 2 + 10);

  for (const line of lines) {
    ctx.fillText(line, width / 2, y);
    y += lineHeight;
  }

  // Divider line
  ctx.strokeStyle = 'rgba(229, 190, 103, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 180, height - 145);
  ctx.lineTo(width / 2 + 180, height - 145);
  ctx.stroke();

  // Footer attribution
  ctx.fillStyle = '#e5be67';
  ctx.font = 'bold 22px "Cairo", Tahoma, sans-serif';
  ctx.fillText(footer || '', width / 2, height - 104);

  if (subtitle) {
    ctx.fillStyle = '#9bb5ae';
    ctx.font = '18px "Cairo", Tahoma, sans-serif';
    ctx.fillText(subtitle, width / 2, height - 68);
  }

  return canvas.toDataURL('image/png');
}

// Este es el link de monto libre usado por defecto para todos los regalos.
// Podés reemplazar un regalo puntual por un link fijo en el objeto de abajo.
const defaultMercadoPagoLink = {
  url: 'https://link.mercadopago.com.ar/lucasmouhsen',
  hasFixedAmount: false,
}

export const mercadoPagoGiftLinks = {
  'honeymoon-contribution-10000': {
    url: 'https://mpago.la/2nxgKUN',
    hasFixedAmount: true,
  },
}

export function getMercadoPagoGiftLink(giftId) {
  const configuredLink = mercadoPagoGiftLinks[giftId] || defaultMercadoPagoLink
  const link = typeof configuredLink === 'string' ? configuredLink.trim() : configuredLink?.url?.trim()

  if (!link) {
    return null
  }

  try {
    const url = new URL(link)
    const isMercadoPagoLink = ['link.mercadopago.com.ar', 'mpago.la'].includes(url.hostname)

    return url.protocol === 'https:' && isMercadoPagoLink
      ? { url: url.href, hasFixedAmount: configuredLink?.hasFixedAmount !== false }
      : null
  } catch {
    return null
  }
}

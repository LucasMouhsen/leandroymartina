import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import EventFeatureHero from '../components/EventFeatureHero.jsx'
import { useWedding } from '../context/useWedding.jsx'

const schema = z.object({
  guestName: z.string().min(2, 'Ingresa tu nombre.'),
  guestContact: z.string().min(4, 'Deja una via de contacto.'),
  amount: z.coerce.number().optional(),
  notes: z.string().max(240).optional(),
})

const freeContributionCard = {
  id: 'free',
  name: 'Aporte libre',
  suggestedAmount: 50000,
  image: '/assets/optimized/gallery-bg.webp',
  description: 'Si preferis sumar con el monto que quieras, podes hacerlo desde aca.',
  category: 'aporte',
}

const PAGE_SIZE = 12

function roundUpPrice(value) {
  if (value <= 500000) {
    return Math.ceil(value / 50000) * 50000
  }

  return Math.ceil(value / 100000) * 100000
}

function buildPageItems(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const items = []
  const isNearStart = currentPage <= 3
  const isNearEnd = currentPage >= totalPages - 2

  if (isNearStart) {
    items.push(1, 2, 3, 'end-ellipsis', totalPages)
    return items
  }

  if (isNearEnd) {
    items.push(1, 'start-ellipsis', totalPages - 2, totalPages - 1, totalPages)
    return items
  }

  items.push(1, 'start-ellipsis', currentPage, 'end-ellipsis', totalPages)
  return items
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function classifyGift(name) {
  const value = normalizeText(name)

  if (value.includes('sillon') || value.includes('sofa') || value.includes('vajillero') || value.includes('banco')) {
    return 'muebles'
  }

  if (value.includes('cafetera') || value.includes('tostadora') || value.includes('thermomix') || value.includes('nespresso')) {
    return 'cocina'
  }

  if (value.includes('acolchado') || value.includes('almohadon') || value.includes('alfombra') || value.includes('toalla')) {
    return 'textil'
  }

  if (value.includes('vela') || value.includes('bowl') || value.includes('bandeja') || value.includes('canasto') || value.includes('jarron') || value.includes('taza') || value.includes('vaso')) {
    return 'deco'
  }

  if (value.includes('valija') || value.includes('voucher')) {
    return 'viaje'
  }

  return 'otros'
}

export default function GiftsPage() {
  const { weddingEvent, giftItems, submitGiftContribution, uploadPublicFile } = useWedding()
  const [selectedGiftId, setSelectedGiftId] = useState(null)
  const [status, setStatus] = useState(null)
  const [proofFile, setProofFile] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('alpha-asc')
  const [category, setCategory] = useState('all')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  const publicGiftItems = useMemo(
    () => [...giftItems.map((gift) => ({ ...gift, category: classifyGift(gift.name) })), freeContributionCard],
    [giftItems],
  )
  const priceCeiling = useMemo(
    () => roundUpPrice(Math.max(...publicGiftItems.map((gift) => gift.suggestedAmount), 0)),
    [publicGiftItems],
  )
  const effectiveMinPrice = minPrice === '' ? 0 : Number(minPrice)
  const effectiveMaxPrice = maxPrice === '' ? priceCeiling : Number(maxPrice)
  const minThumbPosition = priceCeiling === 0 ? 0 : (effectiveMinPrice / priceCeiling) * 100
  const maxThumbPosition = priceCeiling === 0 ? 100 : (effectiveMaxPrice / priceCeiling) * 100
  const categoryOptions = useMemo(() => {
    const categories = new Set(publicGiftItems.map((gift) => gift.category))
    return ['all', ...categories]
  }, [publicGiftItems])
  const filteredGiftItems = useMemo(() => {
    const normalizedQuery = normalizeText(search)

    const filtered = publicGiftItems.filter((gift) => {
      const matchesQuery = normalizedQuery === '' || normalizeText(gift.name).includes(normalizedQuery)
      const matchesCategory = category === 'all' || gift.category === category
      const matchesMin = gift.suggestedAmount >= effectiveMinPrice
      const matchesMax = gift.suggestedAmount <= effectiveMaxPrice

      return matchesQuery && matchesCategory && matchesMin && matchesMax
    })

    filtered.sort((left, right) => {
      switch (sortBy) {
        case 'alpha-desc':
          return left.name.localeCompare(right.name) * -1
        case 'price-asc':
          return left.suggestedAmount - right.suggestedAmount
        case 'price-desc':
          return right.suggestedAmount - left.suggestedAmount
        default:
          return left.name.localeCompare(right.name)
      }
    })

    return filtered
  }, [category, effectiveMaxPrice, effectiveMinPrice, publicGiftItems, search, sortBy])
  const totalPages = Math.max(1, Math.ceil(filteredGiftItems.length / PAGE_SIZE))
  const pageItems = useMemo(
    () => buildPageItems(currentPage, totalPages),
    [currentPage, totalPages],
  )
  const paginatedGiftItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredGiftItems.slice(start, start + PAGE_SIZE)
  }, [currentPage, filteredGiftItems])
  const selectedGift = useMemo(
    () => publicGiftItems.find((gift) => gift.id === selectedGiftId) ?? null,
    [publicGiftItems, selectedGiftId],
  )
  const isFreeContribution = selectedGift?.id === 'free'

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      guestName: '',
      guestContact: '',
      amount: freeContributionCard.suggestedAmount,
      notes: '',
    },
  })

  useEffect(() => {
    if (!selectedGift) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedGiftId(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedGift])

  const closeModal = () => {
    setSelectedGiftId(null)
    setStatus(null)
    setProofFile(null)
  }

  const goToPage = (page) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openGiftModal = (gift) => {
    form.reset({
      guestName: '',
      guestContact: '',
      amount: gift.suggestedAmount,
      notes: '',
    })
    setProofFile(null)
    setStatus(null)
    setSelectedGiftId(gift.id)
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (!selectedGift) {
      return
    }

    let proof = null

    if (proofFile) {
      const uploaded = await uploadPublicFile(proofFile, 'proof')

      if (!uploaded.ok) {
        setStatus(uploaded.message)
        return
      }

      proof = uploaded.file
    }

    const amount = isFreeContribution
      ? Number(values.amount || 0)
      : selectedGift.suggestedAmount

    if (amount <= 0) {
      setStatus('Ingresa un monto valido para continuar.')
      return
    }

    await submitGiftContribution({
      giftItemId: isFreeContribution ? null : selectedGift.id,
      guestName: values.guestName,
      guestContact: values.guestContact,
      amount,
      notes: values.notes,
      proof,
    })

    setStatus('Gracias. El pago quedo registrado y pendiente de validacion.')
    form.reset({
      guestName: '',
      guestContact: '',
      amount: selectedGift.suggestedAmount,
      notes: '',
    })
    setProofFile(null)
  })

  const handleMinPriceChange = (value) => {
    const nextValue = Math.min(Number(value), effectiveMaxPrice)
    setMinPrice(String(nextValue))
    setCurrentPage(1)
  }

  const handleMaxPriceChange = (value) => {
    const nextValue = Math.max(Number(value), effectiveMinPrice)
    setMaxPrice(String(Math.min(nextValue, priceCeiling)))
    setCurrentPage(1)
  }

  return (
    <section className="feature-page">
      <EventFeatureHero
        weddingEvent={weddingEvent}
        title="Lista de regalos"
        portraitAlt="Leandro y Martina"
      />

      <div className="catalog-toolbar">
        <label>
          Rango de precios
          <div className="catalog-toolbar__price-range">
            <div className="catalog-toolbar__price-display" aria-hidden="true">
              <span className="catalog-toolbar__price-caption">Min $</span>
              <span className="catalog-toolbar__price-caption catalog-toolbar__price-caption--end">Max $</span>
              <strong>{effectiveMinPrice}</strong>
              <strong>{effectiveMaxPrice}</strong>
            </div>

            <div
              className="catalog-toolbar__price-sliders"
              style={{
                '--range-start': `${minThumbPosition}%`,
                '--range-end': `${maxThumbPosition}%`,
              }}
            >
              <label className="sr-only" htmlFor="min-price-range">
                Precio minimo
              </label>
              <input
                id="min-price-range"
                type="range"
                min="0"
                max={priceCeiling}
                step="10000"
                value={effectiveMinPrice}
                onChange={(event) => handleMinPriceChange(event.target.value)}
              />

              <label className="sr-only" htmlFor="max-price-range">
                Precio maximo
              </label>
              <input
                id="max-price-range"
                type="range"
                min="0"
                max={priceCeiling}
                step="10000"
                value={effectiveMaxPrice}
                onChange={(event) => handleMaxPriceChange(event.target.value)}
              />
            </div>
          </div>
        </label>

        <label>
          Categoria
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value)
              setCurrentPage(1)
            }}
          >
            {categoryOptions.map((option) => (
              <option value={option} key={option}>
                {option === 'all' ? 'Cualquiera' : option}
              </option>
            ))}
          </select>
        </label>

        <label>
          Buscar
          <input
            type="search"
            placeholder="Nombre del regalo"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setCurrentPage(1)
            }}
          />
        </label>

        <label>
          Ordenar
          <select
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value)
              setCurrentPage(1)
            }}
          >
            <option value="alpha-asc">Alfabeticamente (A-Z)</option>
            <option value="alpha-desc">Alfabeticamente (Z-A)</option>
            <option value="price-asc">Menor precio</option>
            <option value="price-desc">Mayor precio</option>
          </select>
        </label>
      </div>

      <div className="gift-grid gift-grid--catalog">
        {paginatedGiftItems.map((gift) => (
          <article className="gift-card gift-card--interactive" key={gift.id}>
            <button
              type="button"
              className="gift-card__trigger"
              onClick={() => openGiftModal(gift)}
            >
              <img src={gift.image} alt={gift.name} loading="lazy" decoding="async" />
              <div className="gift-card__body">
                <div className="gift-card__header">
                  <div className="gift-card__title-wrap">
                    <h3>{gift.name}</h3>
                  </div>
                  <strong>${gift.suggestedAmount.toLocaleString('es-AR')}</strong>
                </div>

                {gift.description ? (
                  <p className="gift-card__description">{gift.description}</p>
                ) : null}

                <span className="gift-card__cta" aria-hidden="true">
                  {gift.id === 'free' ? 'Aportar' : 'Regalar'}
                </span>
              </div>
            </button>
          </article>
        ))}
      </div>

      <div className="catalog-pagination">
        <p className="catalog-pagination__summary">
          Pagina {currentPage} de {totalPages}. Mostrando {paginatedGiftItems.length} de {filteredGiftItems.length} regalos.
        </p>
        <div className="catalog-pagination__controls">
          <button
            type="button"
            className="catalog-nav-button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Pagina anterior"
          >
            &#8249;
          </button>

          <div className="catalog-pagination__pages">
            <div className="catalog-pagination__pages-full">
              {pageItems.map((item) =>
                typeof item === 'number' ? (
                  <button
                    type="button"
                    key={item}
                    className={item === currentPage ? 'catalog-page-chip is-active' : 'catalog-page-chip'}
                    onClick={() => goToPage(item)}
                  >
                    {item}
                  </button>
                ) : (
                  <span className="catalog-page-ellipsis" key={item}>
                    ...
                  </span>
                ),
              )}
            </div>

            <div className="catalog-pagination__pages-compact">
              <span className="catalog-page-chip is-active" aria-current="page">
                {currentPage}
              </span>
              {totalPages > 1 ? (
                <button
                  type="button"
                  className="catalog-page-chip"
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  aria-label={`Ir a la pagina ${totalPages}`}
                >
                  {totalPages}
                </button>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            className="catalog-nav-button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Pagina siguiente"
          >
            &#8250;
          </button>
        </div>
      </div>

      {selectedGift ? (
        <div className="gift-modal" role="dialog" aria-modal="true" aria-labelledby="gift-modal-title">
          <div className="gift-modal__backdrop" onClick={closeModal} />
          <div className="gift-modal__panel">
            <button type="button" className="gift-modal__close" onClick={closeModal} aria-label="Cerrar">
              ×
            </button>

            <div className="gift-modal__layout">
              <div className="gift-modal__summary">
                <img src={selectedGift.image} alt={selectedGift.name} />
                <p className="feature-kicker">Regalo elegido</p>
                <h3 id="gift-modal-title">{selectedGift.name}</h3>
                {selectedGift.description ? <p>{selectedGift.description}</p> : null}
                <strong className="gift-modal__price">
                  ${selectedGift.suggestedAmount.toLocaleString('es-AR')}
                </strong>

                <div className="gift-modal__payment-box">
                  <span>Datos de transferencia</span>
                  {weddingEvent.giftInstructions.map((item) => (
                    <strong key={item}>{item}</strong>
                  ))}
                </div>
              </div>

              <form className="form-card gift-modal__form" onSubmit={onSubmit}>
                <div className="form-grid two-columns">
                  <label>
                    Tu nombre
                    <input {...form.register('guestName')} />
                    <span>{form.formState.errors.guestName?.message}</span>
                  </label>
                  <label>
                    Contacto
                    <input placeholder="Email o WhatsApp" {...form.register('guestContact')} />
                    <span>{form.formState.errors.guestContact?.message}</span>
                  </label>
                </div>

                {isFreeContribution ? (
                  <label>
                    Monto del aporte
                    <input type="number" min="1" {...form.register('amount', { valueAsNumber: true })} />
                    <span>{form.formState.errors.amount?.message}</span>
                  </label>
                ) : (
                  <div className="gift-modal__fixed-amount">
                    <span>Monto a registrar</span>
                    <strong>${selectedGift.suggestedAmount.toLocaleString('es-AR')}</strong>
                  </div>
                )}

                <label>
                  Dedicatoria o mensaje
                  <textarea rows="4" {...form.register('notes')} />
                </label>

                <label className="file-field">
                  Comprobante opcional
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
                  />
                  <small>{proofFile ? proofFile.name : 'Adjunta imagen o PDF hasta 5 MB.'}</small>
                </label>

                <button className="primary-button" type="submit">
                  Ya pague este regalo
                </button>

                {status ? <p className="form-feedback">{status}</p> : null}
              </form>
          </div>
        </div>
      </div>
      ) : null}
    </section>
  )
}

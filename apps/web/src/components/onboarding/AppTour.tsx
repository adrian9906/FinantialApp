import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleHelp } from 'lucide-react'
import { driver, type DriveStep, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { Button } from '@/components/ui/button'

const TOUR_STORAGE_KEY = 'plata-app:web-tour:v1'

function isVisible(selector: string) {
  const element = document.querySelector<HTMLElement>(selector)
  if (!element || !element.getClientRects().length) return false
  const rect = element.getBoundingClientRect()
  return rect.right > 0 && rect.left < window.innerWidth && rect.bottom > 0 && rect.top < window.innerHeight
}

type MobileTourStep = DriveStep & { route?: string; menu?: boolean }

const mobileSections = [
  ['/', 'Dashboard', 'Consulta el resumen del mes, los gráficos y las acciones rápidas.'],
  ['/salary', 'Ingresos', 'Organiza tus cuentas y registra cobros, trabajos e ingresos extra.'],
  ['/expenses', 'Gastos', 'Registra gastos, marca los realizados y filtra tus movimientos.'],
  ['/expense-calendar', 'Calendario de gastos', 'Toca un día para consultar sus movimientos y sus importes.'],
  ['/wants', 'Gustos', 'Controla las compras y gastos personales que quieres permitirte.'],
  ['/savings', 'Ahorros', 'Consulta y organiza el dinero que has reservado.'],
  ['/debts', 'Deudas', 'Lleva el seguimiento de deudas, pagos y dinero por cobrar.'],
  ['/wishlist', 'Deseos', 'Prioriza tus deseos y reserva dinero para comprarlos.'],
  ['/events', 'Eventos', 'Planifica fechas importantes y sus presupuestos.'],
  ['/projections', 'Proyecciones', 'Explora cómo cambiaría tu planificación con otros ingresos.'],
  ['/reminders', 'Recordatorios', 'Anota pendientes y fechas que necesitas recordar.'],
  ['/subscriptions', 'Suscripciones', 'Organiza tus pagos recurrentes y sus vencimientos.'],
  ['/reports', 'Informes', 'Revisa los resultados y las comparativas de tus movimientos.'],
  ['/currency-calculator', 'Calculadora de divisas', 'Convierte importes entre monedas usando tus tasas configuradas.'],
  ['/settings', 'Ajustes', 'Personaliza la app, tus monedas, las tasas y las preferencias.'],
] as const

function getMobileTourSteps(): MobileTourStep[] {
  return [
    { popover: { title: 'Tu app, paso a paso', description: 'Abriremos el menú y visitaremos cada sección. Puedes avanzar, volver atrás o cerrar cuando quieras.' } },
    { element: '[data-tour="mobile-menu"]', popover: { title: 'Menú principal', description: 'Al avanzar abriremos este menú para mostrarte todas las herramientas.', side: 'bottom' } },
    ...mobileSections.flatMap<MobileTourStep>(([route, title, description]) => [
      { menu: true, element: `[data-tour-route="${route}"]`, popover: { title, description: 'Esta es su entrada en el menú. Pulsa Siguiente para visitar la pantalla.', side: 'bottom', align: 'center' } },
      { route, menu: false, element: () => document.querySelector<HTMLElement>('[data-tour="workspace"] h1, [data-tour="workspace"] [data-slot="card-title"]') ?? document.querySelector<HTMLElement>('[data-tour="workspace"]')!, popover: { title, description, side: 'bottom', align: 'center' } },
    ]),
    { menu: false, element: '[data-tour="global-search"]', popover: { title: 'Búsqueda global', description: 'Toca la lupa para buscar gastos, gustos, deseos, deudas y recordatorios con filtros.', side: 'bottom' } },
    { menu: false, element: '[data-tour="tutorial-button"]', popover: { title: 'Recorrido terminado', description: 'Desde este botón puedes repetir el tutorial. Al terminar volverás a la pantalla donde empezaste.', side: 'bottom' } },
  ]
}

function getTourSteps(): DriveStep[] {
  const steps: DriveStep[] = [
    {
      popover: {
        title: 'Bienvenido a Plata App',
        description: 'En menos de un minuto conocerás dónde registrar, consultar y organizar tus finanzas.',
        side: 'bottom',
        align: 'center',
      },
    },
  ]

  if (isVisible('[data-tour="sidebar-brand"]')) {
    steps.push({
      element: '[data-tour="sidebar-brand"]',
      popover: {
        title: 'Tu centro financiero',
        description: 'Aquí puedes ver la fórmula de presupuesto activa y volver siempre al panel principal.',
        side: 'right',
        align: 'start',
      },
    })
  }

  if (isVisible('[data-tour="navigation"]')) {
    steps.push({
      element: '[data-tour="navigation"]',
      popover: {
        title: 'Todo está organizado por áreas',
        description: 'Registra salario, gastos, gustos y ahorros; también puedes controlar deudas, eventos, informes y más.',
        side: 'right',
        align: 'center',
      },
    })
  } else if (isVisible('[data-tour="mobile-menu"]')) {
    steps.push({
      element: '[data-tour="mobile-menu"]',
      popover: {
        title: 'Menú principal',
        description: 'Abre este menú para moverte entre todas las herramientas de la aplicación.',
        side: 'bottom',
        align: 'start',
      },
    })
  }

  steps.push(
    {
      element: '[data-tour="global-search"]',
      popover: {
        title: 'Encuentra cualquier sección',
        description: 'Usa la búsqueda rápida para saltar a una herramienta sin recorrer todo el menú.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="workspace"]',
      popover: {
        title: 'Tu espacio de trabajo',
        description: 'Cada pantalla reúne indicadores y acciones de un área. Los datos que registres alimentan automáticamente el dashboard y los informes.',
        side: 'top',
        align: 'center',
      },
    },
  )

  if (isVisible('[data-tour="profile"]')) {
    steps.push({
      element: '[data-tour="profile"]',
      popover: {
        title: 'Cuenta y sesión',
        description: 'Desde aquí puedes identificar la cuenta activa o cerrar la sesión de forma segura.',
        side: 'right',
        align: 'end',
      },
    })
  }

  steps.push({
    element: '[data-tour="tutorial-button"]',
    popover: {
      title: 'Vuelve cuando quieras',
      description: 'Puedes repetir este recorrido en cualquier momento desde el botón Tutorial.',
      side: 'bottom',
      align: 'end',
    },
  })

  return steps
}

export function AppTour() {
  const navigate = useNavigate()
  const activeTour = useRef<Driver | null>(null)
  const startTour = useCallback(() => {
    if (activeTour.current?.isActive()) return
    const mobile = window.matchMedia('(max-width: 1023px)').matches
    const originalRoute = window.location.pathname + window.location.search + window.location.hash
    const originalMenu = document.querySelector('[data-tour-menu-open="true"]') !== null
    const steps = mobile ? getMobileTourSteps() : getTourSteps()
    let moving = false
    let destroyed = false
    const setMenu = (open: boolean) => window.dispatchEvent(new CustomEvent('plata-tour-menu', { detail: open }))
    const move = async (index: number) => {
      if (moving || destroyed) return
      if (index >= steps.length) { tour.destroy(); return }
      if (index < 0) return
      moving = true
      const step = steps[index] as MobileTourStep
      if (mobile) {
        setMenu(step.menu ?? false)
        if (step.route) navigate(step.route)
        // Wait for React to render the route and the menu slide to finish.
        const started = performance.now()
        await new Promise<void>((resolve) => {
          const check = () => {
            const menu = document.querySelector<HTMLElement>('aside[data-tour-menu-open]')
            const ready = !step.menu || (menu?.dataset.tourMenuOpen === 'true' && menu.getBoundingClientRect().left >= -1)
            if (destroyed || (ready && (!step.route || window.location.pathname === step.route) && performance.now() - started > 60) || performance.now() - started > 1500) resolve()
            else requestAnimationFrame(check)
          }
          requestAnimationFrame(check)
        })
      }
      if (!destroyed) tour.moveTo(index)
      moving = false
    }
    const tour = driver({
      animate: true,
      smoothScroll: true,
      allowKeyboardControl: true,
      allowClose: true,
      overlayClickBehavior: 'close',
      overlayColor: '#09070f',
      overlayOpacity: 0.78,
      stagePadding: 10,
      stageRadius: 14,
      popoverOffset: 14,
      popoverClass: 'plata-app-tour',
      showProgress: true,
      progressText: '{{current}} de {{total}}',
      nextBtnText: 'Siguiente',
      prevBtnText: 'Atrás',
      doneBtnText: 'Terminar',
      disableActiveInteraction: mobile,
      steps,
      ...(mobile ? {
        onNextClick: () => { void move((tour.getActiveIndex() ?? 0) + 1) },
        onPrevClick: () => { void move((tour.getActiveIndex() ?? 0) - 1) },
      } : {}),
      onDestroyed: () => {
        destroyed = true
        activeTour.current = null
        localStorage.setItem(mobile ? `${TOUR_STORAGE_KEY}:mobile-v2` : TOUR_STORAGE_KEY, 'seen')
        if (mobile) { setMenu(originalMenu); navigate(originalRoute) }
      },
    })

    activeTour.current = tour
    if (mobile) setMenu(false)
    tour.drive()
  }, [navigate])

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 1023px)').matches
    if (localStorage.getItem(mobile ? `${TOUR_STORAGE_KEY}:mobile-v2` : TOUR_STORAGE_KEY)) return

    const timer = window.setTimeout(startTour, 700)
    return () => window.clearTimeout(timer)
  }, [startTour])

  useEffect(() => () => { activeTour.current?.destroy() }, [])

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-tour="tutorial-button"
      onClick={startTour}
      className="shrink-0 rounded-xl border-graphite bg-surface/85 text-on-surface shadow-vault-sm hover:bg-surface-container-high hover:text-primary"
      aria-label="Iniciar tutorial de la aplicación"
    >
      <CircleHelp data-icon="inline-start" />
      <span className="hidden sm:inline">Tutorial</span>
    </Button>
  )
}

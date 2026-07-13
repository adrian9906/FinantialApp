import { useCallback, useEffect } from 'react'
import { CircleHelp } from 'lucide-react'
import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import { Button } from '@/components/ui/button'

const TOUR_STORAGE_KEY = 'plata-app:web-tour:v1'

function isVisible(selector: string) {
  const element = document.querySelector<HTMLElement>(selector)
  return Boolean(element && element.getClientRects().length > 0)
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
  const startTour = useCallback(() => {
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
      steps: getTourSteps(),
      onDestroyed: () => localStorage.setItem(TOUR_STORAGE_KEY, 'completed'),
    })

    tour.drive()
  }, [])

  useEffect(() => {
    if (localStorage.getItem(TOUR_STORAGE_KEY)) return

    const timer = window.setTimeout(startTour, 700)
    return () => window.clearTimeout(timer)
  }, [startTour])

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

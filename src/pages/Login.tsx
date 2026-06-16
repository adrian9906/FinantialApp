import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles, User, UserRoundPlus } from 'lucide-react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

type AuthView = 'login' | 'register'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const authMode = useAuthStore((state) => state.authMode)
  const login = useAuthStore((state) => state.login)
  const register = useAuthStore((state) => state.register)
  const continueAsGuest = useAuthStore((state) => state.continueAsGuest)
  const isChecking = useAuthStore((state) => state.isChecking)
  const hasChecked = useAuthStore((state) => state.hasChecked)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
    rememberMe: true,
  })
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    rememberMe: true,
  })

  const currentView = searchParams.get('mode') === 'register' ? 'register' : 'login'

  const redirectTo = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null
    return state?.from?.pathname ?? '/'
  }, [location.state])

  useEffect(() => {
    if (!hasChecked) {
      void useAuthStore.getState().checkSession()
    }
  }, [hasChecked])

  if (!isChecking && authMode === 'authenticated') {
    return <Navigate to={redirectTo} replace />
  }

  function switchView(view: AuthView) {
    setSearchParams({ mode: view })
  }

  async function handleLoginSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      await login(loginForm)
      navigate(redirectTo, { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo iniciar sesion.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRegisterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!registerForm.name.trim()) {
      toast.error('Escribe tu nombre para crear la cuenta.')
      return
    }

    if (registerForm.password.length < 6) {
      toast.error('La contrasena debe tener al menos 6 caracteres.')
      return
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      toast.error('Las contrasenas no coinciden.')
      return
    }

    setIsSubmitting(true)

    try {
      await register({
        name: registerForm.name,
        email: registerForm.email,
        password: registerForm.password,
        rememberMe: registerForm.rememberMe,
      })
      navigate(redirectTo, { replace: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo crear la cuenta.'

      if (message.includes('Ya existe una cuenta con ese correo')) {
        setLoginForm((current) => ({
          ...current,
          email: registerForm.email,
          rememberMe: registerForm.rememberMe,
        }))
        switchView('login')
      }

      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleGuestAccess() {
    continueAsGuest()
    navigate(redirectTo, { replace: true })
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.22),transparent_30%),linear-gradient(180deg,rgba(23,23,23,1)_0%,rgba(14,14,14,1)_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:28px_28px]" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(440px,0.95fr)]">
          <section className="flex flex-col justify-center gap-8">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.24em] text-lavender">
              <ShieldCheck className="size-3.5" />
              Plata App
            </div>

            <div className="space-y-4">
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Entra con tu cuenta o prueba la experiencia sin tocar la base de datos.
              </h1>
              <p className="max-w-xl text-base leading-7 text-neutral-300">
                Crea tu espacio financiero, inicia sesion con tus datos o entra como invitado para guardar todo solo en este dispositivo.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">Cuenta completa</p>
                <p className="mt-2 text-sm leading-6 text-neutral-400">
                  Tus movimientos, deseos y recordatorios quedan vinculados a tu cuenta para seguirlos en futuras sesiones.
                </p>
              </div>
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                <p className="text-sm font-semibold text-amber-50">Modo invitado</p>
                <p className="mt-2 text-sm leading-6 text-amber-100/80">
                  Todo queda solo en localhost. Puedes explorar la app sin enviar datos a la BD.
                </p>
              </div>
            </div>
          </section>

          <Card className="border-white/10 bg-[#171717]/90 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:p-8">
            <div className="space-y-5">
              <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-1">
                {(['login', 'register'] as AuthView[]).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => switchView(view)}
                    className={cn(
                      'inline-flex min-w-[150px] items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
                      currentView === view
                        ? 'bg-primary-container text-white shadow-vault'
                        : 'text-neutral-400 hover:text-white'
                    )}
                  >
                    {view === 'login' ? 'Iniciar sesion' : 'Crear cuenta'}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.22em] text-lavender">
                  {currentView === 'login' ? 'Acceso seguro' : 'Nueva cuenta'}
                </p>
                <h2 className="text-2xl font-semibold text-white">
                  {currentView === 'login' ? 'Abre Plata App' : 'Empieza con tu cuenta'}
                </h2>
                <p className="text-sm text-neutral-400">
                  {currentView === 'login'
                    ? 'Usa tu correo y contrasena para continuar.'
                    : 'Crea una cuenta para guardar tus datos en la base de datos y entrar desde futuras sesiones.'}
                </p>
              </div>
            </div>

            {currentView === 'login' ? (
              <form className="mt-8 space-y-5" onSubmit={(event) => void handleLoginSubmit(event)}>
                <div className="space-y-2">
                  <Label className="text-neutral-300">Correo</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
                    <Input
                      type="email"
                      value={loginForm.email}
                      onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                      className="h-12 border-white/10 bg-white/5 pl-10 text-white placeholder:text-neutral-500"
                      placeholder="tu@correo.com"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-neutral-300">Contrasena</Label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={loginForm.password}
                      onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                      className="h-12 border-white/10 bg-white/5 pl-10 pr-12 text-white placeholder:text-neutral-500"
                      placeholder="********"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-3 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 transition-colors hover:text-white"
                      aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <Checkbox
                  checked={loginForm.rememberMe}
                  onCheckedChange={(checked) => setLoginForm((current) => ({ ...current, rememberMe: Boolean(checked) }))}
                  className="text-sm text-neutral-300"
                >
                  <div>
                    <p className="font-medium text-neutral-200">Recuerdame</p>
                    <p className="text-xs text-neutral-500">Manten la sesion abierta en este dispositivo.</p>
                  </div>
                </Checkbox>

                <Button
                  type="submit"
                  disabled={isSubmitting || isChecking}
                  className="h-12 w-full bg-primary-container text-white shadow-vault hover:brightness-110"
                >
                  {isSubmitting ? 'Entrando...' : 'Entrar a Plata App'}
                </Button>
              </form>
            ) : (
              <form className="mt-8 space-y-5" onSubmit={(event) => void handleRegisterSubmit(event)}>
                <div className="space-y-2">
                  <Label className="text-neutral-300">Nombre</Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
                    <Input
                      type="text"
                      value={registerForm.name}
                      onChange={(event) => setRegisterForm((current) => ({ ...current, name: event.target.value }))}
                      className="h-12 border-white/10 bg-white/5 pl-10 text-white placeholder:text-neutral-500"
                      placeholder="Como quieres aparecer"
                      autoComplete="name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-neutral-300">Correo</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
                    <Input
                      type="email"
                      value={registerForm.email}
                      onChange={(event) => setRegisterForm((current) => ({ ...current, email: event.target.value }))}
                      className="h-12 border-white/10 bg-white/5 pl-10 text-white placeholder:text-neutral-500"
                      placeholder="tu@correo.com"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-neutral-300">Contrasena</Label>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={registerForm.password}
                        onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))}
                        className="h-12 border-white/10 bg-white/5 pl-10 pr-12 text-white placeholder:text-neutral-500"
                        placeholder="Minimo 6 caracteres"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute right-3 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 transition-colors hover:text-white"
                        aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-neutral-300">Confirmar contrasena</Label>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
                      <Input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={registerForm.confirmPassword}
                        onChange={(event) => setRegisterForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                        className="h-12 border-white/10 bg-white/5 pl-10 pr-12 text-white placeholder:text-neutral-500"
                        placeholder="Repite la contrasena"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((current) => !current)}
                        className="absolute right-3 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 transition-colors hover:text-white"
                        aria-label={showConfirmPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                      >
                        {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <Checkbox
                  checked={registerForm.rememberMe}
                  onCheckedChange={(checked) => setRegisterForm((current) => ({ ...current, rememberMe: Boolean(checked) }))}
                  className="text-sm text-neutral-300"
                >
                  <div>
                    <p className="font-medium text-neutral-200">Recuerdame</p>
                    <p className="text-xs text-neutral-500">Mantener abierta la sesion despues de crear la cuenta.</p>
                  </div>
                </Checkbox>

                <Button
                  type="submit"
                  disabled={isSubmitting || isChecking}
                  className="h-12 w-full bg-primary-container text-white shadow-vault hover:brightness-110"
                >
                  {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
                </Button>
              </form>
            )}

            <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 size-4 text-amber-200" />
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-amber-50">Entrar como invitado</p>
                    <p className="text-sm leading-6 text-amber-100/80">
                      Puedes probar todas las funciones. Todo lo que crees se guarda solo en este navegador y no se envia a la base de datos.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGuestAccess}
                    className="h-11 w-full border-amber-200/25 bg-transparent text-amber-50 hover:bg-amber-200/10 hover:text-amber-50"
                  >
                    <UserRoundPlus className="mr-2 size-4" />
                    Continuar como invitado
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

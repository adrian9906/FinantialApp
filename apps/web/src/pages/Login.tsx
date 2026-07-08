import { useEffect, useReducer, type FormEvent } from 'react'
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  UserRoundPlus,
} from 'lucide-react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { HexagonBackground } from '@/components/animate-ui/components/backgrounds/hexagon'

type AuthView = 'login' | 'register'

type LoginFormState = {
  email: string
  password: string
  rememberMe: boolean
}

type RegisterFormState = {
  name: string
  email: string
  password: string
  confirmPassword: string
  rememberMe: boolean
}

type AuthUiState = {
  showPassword: boolean
  showConfirmPassword: boolean
  isSubmitting: boolean
  loginForm: LoginFormState
  registerForm: RegisterFormState
}

type AuthUiAction =
  | { type: 'loginField'; field: keyof LoginFormState; value: string | boolean }
  | { type: 'registerField'; field: keyof RegisterFormState; value: string | boolean }
  | { type: 'togglePassword' }
  | { type: 'toggleConfirmPassword' }
  | { type: 'setSubmitting'; value: boolean }
  | { type: 'prefillLoginFromRegister'; email: string; rememberMe: boolean }

const initialAuthUiState: AuthUiState = {
  showPassword: false,
  showConfirmPassword: false,
  isSubmitting: false,
  loginForm: {
    email: '',
    password: '',
    rememberMe: true,
  },
  registerForm: {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    rememberMe: true,
  },
}

function authUiReducer(state: AuthUiState, action: AuthUiAction): AuthUiState {
  switch (action.type) {
    case 'loginField':
      return {
        ...state,
        loginForm: {
          ...state.loginForm,
          [action.field]: action.value,
        },
      }
    case 'registerField':
      return {
        ...state,
        registerForm: {
          ...state.registerForm,
          [action.field]: action.value,
        },
      }
    case 'togglePassword':
      return { ...state, showPassword: !state.showPassword }
    case 'toggleConfirmPassword':
      return { ...state, showConfirmPassword: !state.showConfirmPassword }
    case 'setSubmitting':
      return { ...state, isSubmitting: action.value }
    case 'prefillLoginFromRegister':
      return {
        ...state,
        loginForm: {
          ...state.loginForm,
          email: action.email,
          rememberMe: action.rememberMe,
        },
      }
    default:
      return state
  }
}

function AuthHero() {
  return (
    <section className="flex flex-col justify-center gap-8">
      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-graphite bg-surface/75 px-4 py-2 text-xs uppercase tracking-[0.24em] text-primary">
        <ShieldCheck className="size-3.5" />
        Plata App
      </div>

      <div className="space-y-4">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-on-background sm:text-5xl">
          Entra con tu cuenta o prueba la experiencia sin tocar la base de datos.
        </h1>
        <p className="max-w-xl text-base leading-7 text-muted-gray">
          Crea tu espacio financiero, inicia sesion con tus datos o entra como invitado para guardar todo solo en este dispositivo.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-graphite bg-surface/85 p-4 shadow-vault">
          <p className="text-sm font-semibold text-on-surface">Cuenta completa</p>
          <p className="mt-2 text-sm leading-6 text-muted-gray">
            Tus movimientos, deseos y recordatorios quedan vinculados a tu cuenta para seguirlos en futuras sesiones.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/12 p-4 shadow-vault">
          <p className="text-sm font-semibold text-on-surface">Modo invitado</p>
          <p className="mt-2 text-sm leading-6 text-[color:color-mix(in_srgb,var(--on-surface)_72%,var(--warning))]">
            Todo queda solo en localhost. Puedes explorar la app sin enviar datos a la BD.
          </p>
        </div>
      </div>
    </section>
  )
}

type AuthCardHeaderProps = {
  currentView: AuthView
  onSwitchView: (view: AuthView) => void
}

function AuthCardHeader({ currentView, onSwitchView }: AuthCardHeaderProps) {
  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-2xl border border-graphite bg-surface-container-low p-1">
        {(['login', 'register'] as AuthView[]).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => onSwitchView(view)}
            className={cn(
              'inline-flex min-w-[150px] items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
              currentView === view
                ? 'bg-primary-container text-white shadow-vault'
                : 'text-muted-gray hover:text-on-surface',
            )}
          >
            {view === 'login' ? 'Iniciar sesion' : 'Crear cuenta'}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-primary">
          {currentView === 'login' ? 'Acceso seguro' : 'Nueva cuenta'}
        </p>
        <h2 className="text-2xl font-semibold text-on-surface">
          {currentView === 'login' ? 'Abre Plata App' : 'Empieza con tu cuenta'}
        </h2>
        <p className="text-sm text-muted-gray">
          {currentView === 'login'
            ? 'Usa tu correo y contraseña para continuar.'
            : 'Crea una cuenta para guardar tus datos en la base de datos y entrar desde futuras sesiones.'}
        </p>
      </div>
    </div>
  )
}

type PasswordFieldProps = {
  label: string
  value: string
  placeholder: string
  autoComplete: string
  visible: boolean
  onToggle: () => void
  onChange: (value: string) => void
}

function PasswordField({
  label,
  value,
  placeholder,
  autoComplete,
  visible,
  onToggle,
  onChange,
}: PasswordFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-on-surface">{label}</Label>
      <div className="relative">
        <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-gray" />
        <Input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 border-graphite bg-surface-container-low pl-10 pr-12 text-on-surface placeholder:text-muted-gray"
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-gray transition-colors hover:text-on-surface"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  )
}

type RememberCheckboxProps = {
  checked: boolean
  helper: string
  onCheckedChange: (checked: boolean) => void
}

function RememberCheckbox({ checked, helper, onCheckedChange }: RememberCheckboxProps) {
  return (
    <Checkbox
      checked={checked}
      onCheckedChange={(nextValue) => onCheckedChange(Boolean(nextValue))}
      className="text-sm text-on-surface"
    >
      <div>
        <p className="font-medium text-on-surface">Recuerdame</p>
        <p className="text-xs text-muted-gray">{helper}</p>
      </div>
    </Checkbox>
  )
}

type LoginFormProps = {
  form: LoginFormState
  isSubmitting: boolean
  isChecking: boolean
  showPassword: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onFieldChange: (field: keyof LoginFormState, value: string | boolean) => void
  onTogglePassword: () => void
}

function LoginForm({
  form,
  isSubmitting,
  isChecking,
  showPassword,
  onSubmit,
  onFieldChange,
  onTogglePassword,
}: LoginFormProps) {
  return (
    <form className="mt-8 space-y-5" onSubmit={(event) => void onSubmit(event)}>
      <div className="space-y-2">
        <Label className="text-on-surface">Correo</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-gray" />
          <Input
            type="email"
            value={form.email}
            onChange={(event) => onFieldChange('email', event.target.value)}
            className="h-12 border-graphite bg-surface-container-low pl-10 text-on-surface placeholder:text-muted-gray"
            placeholder="tu@correo.com"
            autoComplete="email"
          />
        </div>
      </div>

      <PasswordField
        label="Contraseña"
        value={form.password}
        placeholder="********"
        autoComplete="current-password"
        visible={showPassword}
        onToggle={onTogglePassword}
        onChange={(value) => onFieldChange('password', value)}
      />

      <RememberCheckbox
        checked={form.rememberMe}
        helper="Manten la sesion abierta en este dispositivo."
        onCheckedChange={(checked) => onFieldChange('rememberMe', checked)}
      />

      <Button
        type="submit"
        disabled={isSubmitting || isChecking}
        className="h-12 w-full bg-primary-container text-primary-foreground shadow-vault hover:brightness-110"
      >
        {isSubmitting ? 'Entrando...' : 'Entrar a Plata App'}
      </Button>
    </form>
  )
}

type RegisterFormProps = {
  form: RegisterFormState
  disabled: boolean
  submitLabel: string
  passwordVisibility: {
    password: boolean
    confirmPassword: boolean
  }
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onFieldChange: (field: keyof RegisterFormState, value: string | boolean) => void
  onTogglePassword: () => void
  onToggleConfirmPassword: () => void
}

function RegisterForm({
  form,
  disabled,
  submitLabel,
  passwordVisibility,
  onSubmit,
  onFieldChange,
  onTogglePassword,
  onToggleConfirmPassword,
}: RegisterFormProps) {
  return (
    <form className="mt-8 space-y-5" onSubmit={(event) => void onSubmit(event)}>
      <div className="space-y-2">
        <Label className="text-on-surface">Nombre</Label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-gray" />
          <Input
            type="text"
            value={form.name}
            onChange={(event) => onFieldChange('name', event.target.value)}
            className="h-12 border-graphite bg-surface-container-low pl-10 text-on-surface placeholder:text-muted-gray"
            placeholder="Como quieres aparecer"
            autoComplete="name"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-on-surface">Correo</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-gray" />
          <Input
            type="email"
            value={form.email}
            onChange={(event) => onFieldChange('email', event.target.value)}
            className="h-12 border-graphite bg-surface-container-low pl-10 text-on-surface placeholder:text-muted-gray"
            placeholder="tu@correo.com"
            autoComplete="email"
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <PasswordField
          label="Contraseña"
          value={form.password}
          placeholder="Minimo 6 caracteres"
          autoComplete="new-password"
          visible={passwordVisibility.password}
          onToggle={onTogglePassword}
          onChange={(value) => onFieldChange('password', value)}
        />

        <PasswordField
          label="Confirmar contraseña"
          value={form.confirmPassword}
          placeholder="Repite la contraseña"
          autoComplete="new-password"
          visible={passwordVisibility.confirmPassword}
          onToggle={onToggleConfirmPassword}
          onChange={(value) => onFieldChange('confirmPassword', value)}
        />
      </div>

      <RememberCheckbox
        checked={form.rememberMe}
        helper="Mantener abierta la sesion despues de crear la cuenta."
        onCheckedChange={(checked) => onFieldChange('rememberMe', checked)}
      />

      <Button
        type="submit"
        disabled={disabled}
        className="h-12 w-full bg-primary-container text-white shadow-vault hover:brightness-110"
      >
        {submitLabel}
      </Button>
    </form>
  )
}

type GuestAccessPanelProps = {
  onGuestAccess: () => void
}

function GuestAccessPanel({ onGuestAccess }: GuestAccessPanelProps) {
  return (
    <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 size-4 text-amber-200" />
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-on-surface">Entrar como invitado</p>
            <p className="text-sm leading-6 text-[color:color-mix(in_srgb,var(--on-surface)_72%,var(--warning))]">
              Puedes probar todas las funciones. Todo lo que crees se guarda solo en este navegador y no se envia a la base de datos.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={onGuestAccess}
            className="h-11 w-full border-amber-500/35 bg-transparent text-on-surface hover:bg-amber-200/15 hover:text-on-surface"
          >
            <UserRoundPlus className="mr-2 size-4" />
            Continuar como invitado
          </Button>
        </div>
      </div>
    </div>
  )
}

type AuthCardProps = {
  currentView: AuthView
  state: AuthUiState
  isChecking: boolean
  onSwitchView: (view: AuthView) => void
  onLoginSubmit: (event: FormEvent<HTMLFormElement>) => void
  onRegisterSubmit: (event: FormEvent<HTMLFormElement>) => void
  onLoginFieldChange: (field: keyof LoginFormState, value: string | boolean) => void
  onRegisterFieldChange: (field: keyof RegisterFormState, value: string | boolean) => void
  onTogglePassword: () => void
  onToggleConfirmPassword: () => void
  onGuestAccess: () => void
}

function AuthCard({
  currentView,
  state,
  isChecking,
  onSwitchView,
  onLoginSubmit,
  onRegisterSubmit,
  onLoginFieldChange,
  onRegisterFieldChange,
  onTogglePassword,
  onToggleConfirmPassword,
  onGuestAccess,
}: AuthCardProps) {
  return (
    <Card className="border-graphite bg-surface/92 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-8">
      <AuthCardHeader currentView={currentView} onSwitchView={onSwitchView} />

      {currentView === 'login' ? (
        <LoginForm
          form={state.loginForm}
          isSubmitting={state.isSubmitting}
          isChecking={isChecking}
          showPassword={state.showPassword}
          onSubmit={onLoginSubmit}
          onFieldChange={onLoginFieldChange}
          onTogglePassword={onTogglePassword}
        />
      ) : (
        <RegisterForm
          form={state.registerForm}
          disabled={state.isSubmitting || isChecking}
          submitLabel={state.isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
          passwordVisibility={{
            password: state.showPassword,
            confirmPassword: state.showConfirmPassword,
          }}
          onSubmit={onRegisterSubmit}
          onFieldChange={onRegisterFieldChange}
          onTogglePassword={onTogglePassword}
          onToggleConfirmPassword={onToggleConfirmPassword}
        />
      )}

      <GuestAccessPanel onGuestAccess={onGuestAccess} />
    </Card>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [, setSearchParams] = useSearchParams()
  const authMode = useAuthStore((state) => state.authMode)
  const login = useAuthStore((state) => state.login)
  const register = useAuthStore((state) => state.register)
  const continueAsGuest = useAuthStore((state) => state.continueAsGuest)
  const isChecking = useAuthStore((state) => state.isChecking)
  const hasChecked = useAuthStore((state) => state.hasChecked)
  const [state, dispatch] = useReducer(authUiReducer, initialAuthUiState)

  const currentView: AuthView =
    new URLSearchParams(location.search).get('mode') === 'register' ? 'register' : 'login'
  const redirectTo =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/'

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

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    dispatch({ type: 'setSubmitting', value: true })

    try {
      await login(state.loginForm)
      navigate(redirectTo, { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo iniciar sesion.')
    } finally {
      dispatch({ type: 'setSubmitting', value: false })
    }
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!state.registerForm.name.trim()) {
      toast.error('Escribe tu nombre para crear la cuenta.')
      return
    }

    if (state.registerForm.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (state.registerForm.password !== state.registerForm.confirmPassword) {
      toast.error('Las contraseñas no coinciden.')
      return
    }

    dispatch({ type: 'setSubmitting', value: true })

    try {
      await register({
        name: state.registerForm.name,
        email: state.registerForm.email,
        password: state.registerForm.password,
        rememberMe: state.registerForm.rememberMe,
      })
      navigate(redirectTo, { replace: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo crear la cuenta.'

      if (message.includes('Ya existe una cuenta con ese correo')) {
        dispatch({
          type: 'prefillLoginFromRegister',
          email: state.registerForm.email,
          rememberMe: state.registerForm.rememberMe,
        })
        switchView('login')
      }

      toast.error(message)
    } finally {
      dispatch({ type: 'setSubmitting', value: false })
    }
  }

  function handleGuestAccess() {
    continueAsGuest()
    navigate(redirectTo, { replace: true })
  }

  return (
    <div
      className="relative min-h-dvh overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at top, color-mix(in srgb, var(--primary-container) 24%, transparent), transparent 30%), linear-gradient(180deg, color-mix(in srgb, var(--surface-dim) 94%, black) 0%, var(--background) 100%)',
      }}
    >
      <HexagonBackground
        hexagonProps={{
          className:
            'before:opacity-45 dark:before:bg-white/12 before:bg-slate-900/10 after:dark:bg-[color:var(--surface-dim)] after:bg-[color:var(--background)]',
        }}
      >
        <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(440px,0.95fr)]">
            <AuthHero />

            <AuthCard
              currentView={currentView}
              state={state}
              isChecking={isChecking}
              onSwitchView={switchView}
              onLoginSubmit={handleLoginSubmit}
              onRegisterSubmit={handleRegisterSubmit}
              onLoginFieldChange={(field, value) =>
                dispatch({ type: 'loginField', field, value })
              }
              onRegisterFieldChange={(field, value) =>
                dispatch({ type: 'registerField', field, value })
              }
              onTogglePassword={() => dispatch({ type: 'togglePassword' })}
              onToggleConfirmPassword={() => dispatch({ type: 'toggleConfirmPassword' })}
              onGuestAccess={handleGuestAccess}
            />
          </div>
        </div>
      </HexagonBackground>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { Eye, EyeOff } from 'lucide-react-native'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BackgroundSurface } from '../../src/components/background-surface'
import { Button } from '../../src/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../src/components/ui/card'
import { Input } from '../../src/components/ui/input'
import { Switch } from '../../src/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../src/components/ui/tabs'
import { Text } from '../../src/components/ui/text'
import { useAuthStore } from '../../src/store/auth-store'
import { usePreferencesStore } from '../../src/store/preferences-store'
import { resolvePalette } from '../../src/theme/palette'

const EyeIcon = Eye as any
const EyeOffIcon = EyeOff as any

export default function LoginScreen() {
  const params = useLocalSearchParams<{ mode?: string }>()
  const authMode = useAuthStore((state) => state.authMode)
  const isChecking = useAuthStore((state) => state.isChecking)
  const login = useAuthStore((state) => state.login)
  const register = useAuthStore((state) => state.register)
  const continueAsGuest = useAuthStore((state) => state.continueAsGuest)
  const appearance = usePreferencesStore((state) => state.appearance)
  const theme = usePreferencesStore((state) => state.theme)
  const palette = resolvePalette(appearance, theme)
  const [view, setView] = useState<'login' | 'register'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  useEffect(() => {
    if (params.mode === 'register') {
      setView('register')
      return
    }

    if (params.mode === 'login') {
      setView('login')
    }
  }, [params.mode])

  if (!isChecking && authMode !== 'anonymous') {
    return <Redirect href="/(app)/dashboard" />
  }

  async function handleLogin() {
    setError(null)
    setIsSubmitting(true)

    try {
      await login(loginForm)
      router.replace('/(app)/dashboard')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'No se pudo iniciar sesion.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRegister() {
    setError(null)

    if (!registerForm.name.trim()) {
      setError('Escribe tu nombre para crear la cuenta.')
      return
    }

    if (registerForm.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setError('Las contraseñas no coinciden.')
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
      router.replace('/(app)/dashboard')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'No se pudo crear la cuenta.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleGuestAccess() {
    await continueAsGuest()
    router.replace('/(app)/dashboard')
  }

  return (
    <BackgroundSurface>
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 24 }}
            showsVerticalScrollIndicator={false}
          >
            <View className="px-4">
              <Card className="mb-4 border-border/80 bg-card/95">
                <CardHeader className="gap-4">
                  <View className="self-start rounded-full border border-border bg-secondary px-4 py-2">
                    <Text className="text-primary text-xs font-bold uppercase tracking-[2px]">Plata App</Text>
                  </View>
                  <CardTitle className="text-3xl leading-9">
                    {view === 'login' ? 'Entra a tu espacio financiero' : 'Crea tu cuenta de Plata App'}
                  </CardTitle>
                  <CardDescription className="text-sm leading-6">
                    Inicia sesión, crea tu cuenta o entra como invitado para guardar todo solo en este teléfono.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-border/80 bg-card/95">
                <CardContent className="pt-6">
                  <Tabs value={view} onValueChange={(value) => setView(value as 'login' | 'register')} className="gap-5">
                    <TabsList className="w-full">
                      <TabsTrigger value="login" className="flex-1">
                        <Text>Iniciar sesión</Text>
                      </TabsTrigger>
                      <TabsTrigger value="register" className="flex-1">
                        <Text>Crear cuenta</Text>
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="login" className="gap-4">
                      <View className="gap-2">
                        <Text className="text-sm font-semibold">Correo</Text>
                        <Input
                          value={loginForm.email}
                          onChangeText={(email) => setLoginForm((state) => ({ ...state, email }))}
                          placeholder="tu@correo.com"
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      </View>

                      <View className="gap-2">
                        <Text className="text-sm font-semibold">Contraseña</Text>
                        <View className="relative">
                          <Input
                            value={loginForm.password}
                            onChangeText={(password) => setLoginForm((state) => ({ ...state, password }))}
                            placeholder="********"
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            className="pr-10"
                          />
                          <Pressable className="absolute right-3 top-3" onPress={() => setShowPassword((value) => !value)}>
                            {showPassword ? <EyeOffIcon size={18} color={palette.textMuted} /> : <EyeIcon size={18} color={palette.textMuted} />}
                          </Pressable>
                        </View>
                      </View>

                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm font-semibold">Recuerdame</Text>
                        <Switch
                          checked={loginForm.rememberMe}
                          onCheckedChange={(rememberMe) => setLoginForm((state) => ({ ...state, rememberMe }))}
                        />
                      </View>

                      <Button onPress={() => void handleLogin()} disabled={isSubmitting}>
                        <Text>{isSubmitting ? 'Entrando...' : 'Entrar a Plata App'}</Text>
                      </Button>
                    </TabsContent>

                    <TabsContent value="register" className="gap-4">
                      <View className="gap-2">
                        <Text className="text-sm font-semibold">Nombre</Text>
                        <Input
                          value={registerForm.name}
                          onChangeText={(name) => setRegisterForm((state) => ({ ...state, name }))}
                          placeholder="Como quieres aparecer"
                          autoCapitalize="words"
                        />
                      </View>

                      <View className="gap-2">
                        <Text className="text-sm font-semibold">Correo</Text>
                        <Input
                          value={registerForm.email}
                          onChangeText={(email) => setRegisterForm((state) => ({ ...state, email }))}
                          placeholder="tu@correo.com"
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      </View>

                      <View className="gap-2">
                        <Text className="text-sm font-semibold">Contraseña</Text>
                        <View className="relative">
                          <Input
                            value={registerForm.password}
                            onChangeText={(password) => setRegisterForm((state) => ({ ...state, password }))}
                            placeholder="Minimo 6 caracteres"
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            className="pr-10"
                          />
                          <Pressable className="absolute right-3 top-3" onPress={() => setShowPassword((value) => !value)}>
                            {showPassword ? <EyeOffIcon size={18} color={palette.textMuted} /> : <EyeIcon size={18} color={palette.textMuted} />}
                          </Pressable>
                        </View>
                      </View>

                      <View className="gap-2">
                        <Text className="text-sm font-semibold">Confirmar contraseña</Text>
                        <View className="relative">
                          <Input
                            value={registerForm.confirmPassword}
                            onChangeText={(confirmPassword) => setRegisterForm((state) => ({ ...state, confirmPassword }))}
                            placeholder="Repite la contraseña"
                            secureTextEntry={!showConfirmPassword}
                            autoCapitalize="none"
                            className="pr-10"
                          />
                          <Pressable className="absolute right-3 top-3" onPress={() => setShowConfirmPassword((value) => !value)}>
                            {showConfirmPassword ? (
                              <EyeOffIcon size={18} color={palette.textMuted} />
                            ) : (
                              <EyeIcon size={18} color={palette.textMuted} />
                            )}
                          </Pressable>
                        </View>
                      </View>

                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm font-semibold">Recuerdame</Text>
                        <Switch
                          checked={registerForm.rememberMe}
                          onCheckedChange={(rememberMe) => setRegisterForm((state) => ({ ...state, rememberMe }))}
                        />
                      </View>

                      <Button onPress={() => void handleRegister()} disabled={isSubmitting}>
                        <Text>{isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}</Text>
                      </Button>
                    </TabsContent>
                  </Tabs>

                  {error ? <Text className="mt-4 text-sm text-destructive">{error}</Text> : null}

                  <View
                    className="mt-6 gap-3 rounded-xl border p-4"
                    style={{
                      borderColor: `${palette.warning}44`,
                      backgroundColor: `${palette.warning}18`,
                    }}
                  >
                    <Text className="font-semibold">Entrar como invitado</Text>
                    <Text className="text-muted-foreground text-sm leading-6">
                      Todo lo que hagas se guarda solo en este dispositivo hasta que decidas iniciar sesion o crear una cuenta.
                    </Text>
                    <Button variant="outline" onPress={() => void handleGuestAccess()}>
                      <Text>Continuar como invitado</Text>
                    </Button>
                  </View>
                </CardContent>
              </Card>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </BackgroundSurface>
  )
}

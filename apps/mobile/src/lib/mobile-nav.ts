import {
  ArrowUpRight,
  Bell,
  Calendar,
  Heart,
  Landmark,
  LayoutDashboard,
  PiggyBank,
  Settings2,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from 'lucide-react-native'

export const mobileNavItems = [
  { href: '/(app)/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/(app)/salary', label: 'Salario', icon: Wallet },
  { href: '/(app)/expenses', label: 'Gastos', icon: ArrowUpRight },
  { href: '/(app)/wants', label: 'Gustos', icon: Heart },
  { href: '/(app)/savings', label: 'Ahorros', icon: PiggyBank },
  { href: '/(app)/debts', label: 'Deudas', icon: Landmark },
  { href: '/(app)/wishlist', label: 'Deseos', icon: ShoppingCart },
  { href: '/(app)/events', label: 'Eventos', icon: Calendar },
  { href: '/(app)/projections', label: 'Proyecciones', icon: TrendingUp },
  { href: '/(app)/reminders', label: 'Recordatorios', icon: Bell },
  { href: '/(app)/settings', label: 'Ajustes', icon: Settings2 },
] as const

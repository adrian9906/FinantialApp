import type { ComponentType } from 'react'
import {
  Activity,
  Archive,
  ArrowDown,
  ArrowUp,
  Bell,
  BrainCircuit,
  Calendar,
  Check,
  ChevronUp,
  Coins,
  Download,
  Globe2,
  GripVertical,
  Heart,
  History,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  MoonStar,
  Palette,
  PiggyBank,
  RefreshCcw,
  RotateCcw,
  Settings2,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  SunMedium,
  TrendingUp,
  Trash2,
  User,
  UserPlus,
  Wallet,
  Repeat2,
  X,
  type LucideProps,
} from 'lucide-react'
import {
  IconActivity,
  IconAdjustmentsHorizontal,
  IconArchive,
  IconArrowDown,
  IconArrowUp,
  IconBell,
  IconBrain,
  IconCalendarEvent,
  IconCheck,
  IconChevronUp,
  IconCoins,
  IconDownload,
  IconGlobe,
  IconGripVertical,
  IconHeart,
  IconHistory,
  IconLayoutDashboard,
  IconLifebuoy,
  IconLogout,
  IconMenu2,
  IconMoon,
  IconPalette,
  IconPigMoney,
  IconRefresh,
  IconRestore,
  IconSettings,
  IconShoppingCart,
  IconSparkles,
  IconSun,
  IconTrendingUp,
  IconTrash,
  IconUser,
  IconUserPlus,
  IconWallet,
  IconRepeat,
  IconX,
  type IconProps as TablerProps,
} from '@tabler/icons-react'

import { cn } from '@/lib/utils'
import { usePreferencesStore, type AppIconPack } from '@/store/preferencesStore'

export type AppIconName =
  | 'dashboard'
  | 'wallet'
  | 'expenses'
  | 'wants'
  | 'savings'
  | 'debts'
  | 'wishlist'
  | 'events'
  | 'trending'
  | 'bell'
  | 'settings'
  | 'reports'
  | 'menu'
  | 'close'
  | 'chevron-up'
  | 'life-buoy'
  | 'logout'
  | 'user'
  | 'user-plus'
  | 'moon'
  | 'sun'
  | 'palette'
  | 'sparkles'
  | 'sliders'
  | 'archive'
  | 'history'
  | 'refresh'
  | 'rotate'
  | 'globe'
  | 'coins'
  | 'check'
  | 'download'
  | 'trash'
  | 'brain'
  | 'grip'
  | 'arrow-up'
  | 'arrow-down'
  | 'subscriptions'

type SvgIcon = ComponentType<LucideProps>
type TablerIcon = ComponentType<TablerProps>

const lucideIcons: Record<AppIconName, SvgIcon> = {
  dashboard: LayoutDashboard,
  wallet: Wallet,
  expenses: Wallet,
  wants: Heart,
  savings: PiggyBank,
  debts: Landmark,
  wishlist: ShoppingCart,
  events: Calendar,
  trending: TrendingUp,
  bell: Bell,
  settings: Settings2,
  reports: Activity,
  menu: Menu,
  close: X,
  'chevron-up': ChevronUp,
  'life-buoy': LifeBuoy,
  logout: LogOut,
  user: User,
  'user-plus': UserPlus,
  moon: MoonStar,
  sun: SunMedium,
  palette: Palette,
  sparkles: Sparkles,
  sliders: SlidersHorizontal,
  archive: Archive,
  history: History,
  refresh: RefreshCcw,
  rotate: RotateCcw,
  globe: Globe2,
  coins: Coins,
  check: Check,
  download: Download,
  trash: Trash2,
  brain: BrainCircuit,
  grip: GripVertical,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  subscriptions: Repeat2,
}

const tablerIcons: Record<AppIconName, TablerIcon> = {
  dashboard: IconLayoutDashboard,
  wallet: IconWallet,
  expenses: IconWallet,
  wants: IconHeart,
  savings: IconPigMoney,
  debts: IconWallet,
  wishlist: IconShoppingCart,
  events: IconCalendarEvent,
  trending: IconTrendingUp,
  bell: IconBell,
  settings: IconSettings,
  reports: IconActivity,
  menu: IconMenu2,
  close: IconX,
  'chevron-up': IconChevronUp,
  'life-buoy': IconLifebuoy,
  logout: IconLogout,
  user: IconUser,
  'user-plus': IconUserPlus,
  moon: IconMoon,
  sun: IconSun,
  palette: IconPalette,
  sparkles: IconSparkles,
  sliders: IconAdjustmentsHorizontal,
  archive: IconArchive,
  history: IconHistory,
  refresh: IconRefresh,
  rotate: IconRestore,
  globe: IconGlobe,
  coins: IconCoins,
  check: IconCheck,
  download: IconDownload,
  trash: IconTrash,
  brain: IconBrain,
  grip: IconGripVertical,
  'arrow-up': IconArrowUp,
  'arrow-down': IconArrowDown,
  subscriptions: IconRepeat,
}

const materialSymbols: Record<AppIconName, string> = {
  dashboard: 'dashboard',
  wallet: 'account_balance_wallet',
  expenses: 'payments',
  wants: 'favorite',
  savings: 'savings',
  debts: 'account_balance',
  wishlist: 'shopping_cart',
  events: 'event',
  trending: 'trending_up',
  bell: 'notifications',
  settings: 'settings',
  reports: 'monitoring',
  menu: 'menu',
  close: 'close',
  'chevron-up': 'expand_less',
  'life-buoy': 'support_agent',
  logout: 'logout',
  user: 'person',
  'user-plus': 'person_add',
  moon: 'dark_mode',
  sun: 'light_mode',
  palette: 'palette',
  sparkles: 'auto_awesome',
  sliders: 'tune',
  archive: 'archive',
  history: 'history',
  refresh: 'refresh',
  rotate: 'restart_alt',
  globe: 'language',
  coins: 'monetization_on',
  check: 'check',
  download: 'download',
  trash: 'delete',
  brain: 'neurology',
  grip: 'drag_indicator',
  'arrow-up': 'keyboard_arrow_up',
  'arrow-down': 'keyboard_arrow_down',
  subscriptions: 'autorenew',
}

export function getIconPackLabel(iconPack: AppIconPack) {
  if (iconPack === 'tabler') return 'Tabler'
  if (iconPack === 'material-symbols') return 'Material Symbols'
  return 'Lucide'
}

interface AppIconProps {
  name: AppIconName
  className?: string
  size?: number
  pack?: AppIconPack
  strokeWidth?: number
  title?: string
}

export function AppIcon({
  name,
  className,
  size = 24,
  pack,
  strokeWidth = 2,
  title,
}: AppIconProps) {
  const selectedPack = usePreferencesStore((state) => state.iconPack)
  const iconPack = pack ?? selectedPack

  if (iconPack === 'tabler') {
    const IconComponent = tablerIcons[name]
    return <IconComponent className={className} size={size} stroke={strokeWidth} title={title} />
  }

  if (iconPack === 'material-symbols') {
    return (
      <span
        title={title}
        aria-hidden={title ? undefined : true}
        className={cn('material-symbols-outlined select-none leading-none', className)}
        style={{
          fontSize: size,
          fontVariationSettings: "'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24",
        }}
      >
        {materialSymbols[name]}
      </span>
    )
  }

  const IconComponent = lucideIcons[name]
  return <IconComponent className={className} size={size} strokeWidth={strokeWidth} aria-hidden={title ? undefined : true} />
}

import { useTheme } from '../lib/useTheme'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
    >
      {theme === 'dark' ? '☀️' : '🌙'} Switch to {next}
    </button>
  )
}

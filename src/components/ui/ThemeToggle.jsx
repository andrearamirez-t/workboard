import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/hooks/useTheme"

export function ThemeToggle() {
  const { isDark, toggle } = useTheme()
  return (
    <Button variant="ghost" size="icon" onClick={toggle}
      className="relative overflow-hidden"
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}>
      <span
        className="absolute inset-0 flex items-center justify-center transition-all duration-300"
        style={{
          opacity: isDark ? 1 : 0,
          transform: isDark ? "rotate(0deg) scale(1)" : "rotate(-90deg) scale(0.5)",
        }}>
        <Sun size={16} />
      </span>
      <span
        className="absolute inset-0 flex items-center justify-center transition-all duration-300"
        style={{
          opacity: isDark ? 0 : 1,
          transform: isDark ? "rotate(90deg) scale(0.5)" : "rotate(0deg) scale(1)",
        }}>
        <Moon size={16} />
      </span>
    </Button>
  )
}

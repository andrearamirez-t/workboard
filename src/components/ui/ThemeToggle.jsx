import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/hooks/useTheme"

export function ThemeToggle() {
  const { isDark, toggle } = useTheme()
  return (
    <Button variant="ghost" size="icon" onClick={toggle}>
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </Button>
  )
}

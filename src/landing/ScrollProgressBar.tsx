import { useScrollProgress } from "./utils"

export function ScrollProgressBar() {
  const p = useScrollProgress()
  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-[2px] bg-transparent pointer-events-none">
      <div
        className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 shadow-[0_0_12px_rgba(245,158,11,0.55)]"
        style={{ width: `${p * 100}%`, transition: "width 80ms linear" }}
      />
    </div>
  )
}

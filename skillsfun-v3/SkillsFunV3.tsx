import { useRef, useState } from 'react'
import { Logo } from './components/Logo'
import { NeonToSkillsFun } from './sections/NeonToSkillsFun'

// The Skills & Fun view: the neon tube reveal -> scroll fade -> iris -> the
// figure section, About, the four boxes and the rising-lines footer, with the
// fixed logo that takes you back to the start. `backRef` is also used by
// mount.tsx to restart from the tube every time the view is entered.
export function SkillsFunV3({ backRef }: { backRef: React.MutableRefObject<(() => void) | null> }) {
  const [revealed, setRevealed] = useState(false)
  const logoBack = useRef(() => backRef.current?.())
  return (
    <main className="bg-black text-neutral-200">
      <Logo show={revealed} onClick={logoBack.current} />
      <NeonToSkillsFun onRevealed={() => setRevealed(true)} backRef={backRef} />
    </main>
  )
}

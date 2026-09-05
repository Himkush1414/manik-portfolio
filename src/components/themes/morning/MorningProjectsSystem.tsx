import { AnimatedFooter } from "@/components/ui/animated-footer";

const PRINCIPLES = [
  {
    k: "01",
    t: "Typography",
    d: "Pragmatica Cond, regular weight only. No bold, no italics — emphasis comes from scale and spacing.",
  },
  {
    k: "02",
    t: "Surface",
    d: "Void black canvas, charcoal cards at a 10px radius. No shadows, no gradients, no depth tricks.",
  },
  {
    k: "03",
    t: "Accent",
    d: "Ember rust is a 1px stroke and nothing more — a highlight along an edge, never a fill.",
  },
];

// The Ciridae design-system treatment begins here, directly below the
// Nightmare hero. Styling is governed entirely by the `.ciridae-system`
// scope in globals.css — it must not bleed into the hero above.
export default function MorningProjectsSystem() {
  return (
    <section className="ciridae-system w-full">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-[40px] px-[24px] py-[100px] sm:px-[40px] sm:py-[122px]">
        <header className="flex flex-col gap-[16px]">
          <p className="cir-caption">[ Ciridae — System 001 ]</p>
          <h2 className="cir-heading-lg max-w-[20ch]">Built from bone, rust and void</h2>
          <p className="cir-body max-w-[54ch]">
            A restrained system for the work that follows: one weight, one voice, all caps.
            Surfaces stay flat, contrast does the talking, and rust appears only as a hairline.
          </p>
        </header>

        <hr className="cir-rule" />

        <div className="grid gap-[20px] sm:grid-cols-3">
          {PRINCIPLES.map(principle => (
            <article key={principle.k} className="cir-card flex flex-col gap-[10px]">
              <p className="cir-caption">{principle.k}</p>
              <h3 className="cir-heading-sm">{principle.t}</h3>
              <p className="cir-body">{principle.d}</p>
            </article>
          ))}
        </div>

        <div className="cir-accent">
          <p className="cir-body max-w-[54ch]">
            Everything below this line is rendered in the Ciridae system.
          </p>
        </div>

        <div>
          <button type="button" className="cir-btn">
            Explore the system
          </button>
        </div>
      </div>

      {/* Scroll-triggered two-hand ASCII effect: a left and right hand slide in
          from opposite edges as this block enters the viewport and meet in the
          middle. Reveal + pointer parallax are built into AnimatedFooter. */}
      <div className="relative h-[72vh] min-h-[440px] w-full overflow-hidden">
        <AnimatedFooter
          headingLines={["Connect"]}
          leftImage="/animated-footer/hand-left.svg"
          rightImage="/animated-footer/hand-right.svg"
          background="#0b0b0b"
          textColor="#edebe7"
          charColor="#cc6437"
          hoverColor="#edebe7"
          hoverCharColor="#0b0b0b"
          parallaxStrength={12}
        />
      </div>
    </section>
  );
}

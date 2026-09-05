"use client";

import { morningDisplayFont } from "./fonts";

export default function MorningProjects() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center overflow-hidden bg-black px-2">
      <h1
        className={`${morningDisplayFont.className} w-full select-none text-center font-black uppercase leading-none tracking-[-0.04em] text-[#F5F3EC] text-[15vw]`}
      >
        Nightmare
      </h1>
    </main>
  );
}

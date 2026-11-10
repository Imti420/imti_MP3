import { createFileRoute } from "@tanstack/react-router";
import { Bench } from "@/components/bench";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 py-8 sm:py-14">
      <Bench />
    </main>
  );
}


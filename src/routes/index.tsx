import { createFileRoute } from "@tanstack/react-router";
import { Bench } from "@/components/bench";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 py-7 sm:px-5 sm:py-12">
      <Bench />
    </main>
  );
}

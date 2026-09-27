import { LogoMark } from "@/components/ui/logo";

export default function Loading() {
  return (
    <main className="grid min-h-dvh place-items-center">
      <div className="animate-pulse">
        <LogoMark size={48} />
      </div>
    </main>
  );
}

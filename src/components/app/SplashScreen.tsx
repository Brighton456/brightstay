import { LogoMark } from "./Logo";

export function SplashScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gradient-cream">
      <div className="flex flex-col items-center gap-6 animate-scale-in">
        <LogoMark className="h-16 w-16 text-[30px] animate-float" />
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full gradient-brand animate-pulse-soft"
              style={{ animationDelay: `${i * 180}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
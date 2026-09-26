import { Link } from "react-router-dom";
import { LogoMark } from "@/components/app/Logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gradient-cream px-6 text-center">
      <LogoMark className="h-14 w-14 text-[26px] mb-8" />
      <p className="font-display text-[80px] font-semibold leading-none text-gradient-brand">404</p>
      <h1 className="mt-4 font-display text-2xl font-semibold text-foreground">This corner is still under construction</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The page you're looking for doesn't exist or moved to a new wing.
      </p>
      <Link to="/" className="mt-8">
        <Button className="gap-2 rounded-full">Back to BrightStay</Button>
      </Link>
    </div>
  );
}
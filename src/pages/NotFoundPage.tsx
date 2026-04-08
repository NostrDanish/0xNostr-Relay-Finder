import { Link } from "react-router-dom";
import { Radio, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
        <Radio className="w-10 h-10 text-primary" />
      </div>
      <h1 className="text-6xl font-black gradient-text mb-2">404</h1>
      <h2 className="text-2xl font-bold mb-3">Page Not Found</h2>
      <p className="text-muted-foreground mb-8 max-w-md">
        This page doesn't exist. Perhaps the relay you're looking for disconnected?
      </p>
      <div className="flex gap-3">
        <Link to="/">
          <Button className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Button>
        </Link>
        <Link to="/relays">
          <Button variant="outline">Explore Relays</Button>
        </Link>
      </div>
    </div>
  );
}

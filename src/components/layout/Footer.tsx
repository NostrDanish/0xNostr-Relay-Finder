import { Link } from "react-router-dom";
import { Radio, Github, ExternalLink } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-background/50 mt-20">
      <div className="container mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                <Radio className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="font-bold text-base">
                <span className="gradient-text">0x</span>
                <span>NostrRelays</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The most comprehensive Nostr relay directory. Find the perfect relay for your needs.
            </p>
            <p className="text-xs text-muted-foreground">
              Vibed with{" "}
              <a
                href="https://shakespeare.diy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Shakespeare
              </a>
            </p>
          </div>

          {/* Explore */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Explore</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/relays" className="hover:text-foreground transition-colors">All Relays</Link></li>
              <li><Link to="/relays?pricing=free" className="hover:text-foreground transition-colors">Free Relays</Link></li>
              <li><Link to="/relays?pricing=paid" className="hover:text-foreground transition-colors">Paid Relays</Link></li>
              <li><Link to="/relays?minUptime=99" className="hover:text-foreground transition-colors">99%+ Uptime</Link></li>
            </ul>
          </div>

          {/* By Use Case */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">By Use Case</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/relays?useCase=General" className="hover:text-foreground transition-colors">General Purpose</Link></li>
              <li><Link to="/relays?useCase=Privacy" className="hover:text-foreground transition-colors">Privacy Focused</Link></li>
              <li><Link to="/relays?useCase=High+Performance" className="hover:text-foreground transition-colors">High Performance</Link></li>
              <li><Link to="/relays?useCase=Censorship+Resistant" className="hover:text-foreground transition-colors">Censorship Resistant</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/about" className="hover:text-foreground transition-colors">About Nostr Relays</Link></li>
              <li><Link to="/about#scoring" className="hover:text-foreground transition-colors">How Scores Work</Link></li>
              <li><Link to="/api" className="hover:text-foreground transition-colors">Public API</Link></li>
              <li><Link to="/submit" className="hover:text-foreground transition-colors">Submit a Relay</Link></li>
              <li>
                <a
                  href="https://github.com/nostr-protocol/nostr/blob/master/nips/11.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors flex items-center gap-1"
                >
                  NIP-11 Spec <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© 2024 0xNostrRelays. Built for the Nostr community.</p>
          <div className="flex items-center gap-4">
            <a
              href="https://nostr.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors flex items-center gap-1"
            >
              Nostr Protocol <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://github.com/nostr-protocol/nostr"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Github className="w-3.5 h-3.5" />
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

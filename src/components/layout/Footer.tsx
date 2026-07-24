import { Link } from "react-router-dom";
import { Github, ExternalLink, Shield } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-background/50 mt-20">
      <div className="container mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <img src="/logo.webp" alt="0xRelay-Finder logo" className="w-7 h-7 rounded-lg object-contain" />
              <span className="font-bold text-base">
                <span className="gradient-text">0x</span>
                <span>Relay-Finder</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The most comprehensive Nostr relay directory. Find the perfect relay for your needs.
            </p>
            {/* 0xPrivacy branding — in brand column only */}
            <div className="pt-1 space-y-1.5">
              <div className="text-xs text-muted-foreground/70">Part of</div>
              <a
                href="https://0xPrivacy.online"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary/80 hover:text-primary hover:underline transition-colors font-medium"
              >
                <Shield className="w-3 h-3" />
                0xPrivacy.online
                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
              </a>
              <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
                Privacy tools, guides &amp; decentralised infrastructure
              </p>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
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

          {/* Discover */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Discover</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/atlas" className="hover:text-foreground transition-colors">Nostr Atlas</Link></li>
              <li><Link to="/explore" className="hover:text-foreground transition-colors">Explore Relays</Link></li>
              <li><Link to="/relays" className="hover:text-foreground transition-colors">Full Directory</Link></li>
              <li><Link to="/build" className="hover:text-foreground transition-colors">Build My Relay Set</Link></li>
              <li><Link to="/compare" className="hover:text-foreground transition-colors">Compare Relays</Link></li>
              <li><Link to="/recommend" className="hover:text-foreground transition-colors">Quick Quiz</Link></li>
              <li><Link to="/lookup" className="hover:text-foreground transition-colors">Fix My Nostr</Link></li>
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
              <li><Link to="/software" className="hover:text-foreground transition-colors">Relay Software</Link></li>
              <li><Link to="/graveyard" className="hover:text-foreground transition-colors">Relay Graveyard</Link></li>
              <li><Link to="/about" className="hover:text-foreground transition-colors">About Nostr Relays</Link></li>
              <li><Link to="/api" className="hover:text-foreground transition-colors">Protocol Docs</Link></li>
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
          <p>
            © {new Date().getFullYear()}{" "}
            <a
              href="https://0xPrivacy.online"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              0xPrivacy.online
            </a>{" "}
            · 0xRelay-Finder. Built for the Nostr community.
          </p>
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

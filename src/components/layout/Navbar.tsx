import { useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Search, Menu, X, Zap, Moon, Sun, Radio,
  LogOut, LayoutDashboard, User, ChevronDown,
  Crown, Shield, UserCog, Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/useTheme";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useLoginActions } from "@/hooks/useLoginActions";
import { useLoggedInAccounts } from "@/hooks/useLoggedInAccounts";
import { LoginArea } from "@/components/auth/LoginArea";
import { cn } from "@/lib/utils";
import { genUserName } from "@/lib/genUserName";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/relays", label: "Explore" },
  { href: "/api", label: "API" },
  { href: "/submit", label: "Submit" },
  { href: "/about", label: "About" },
];

const ROLE_ICONS = {
  owner: Crown,
  admin: Shield,
  moderator: UserCog,
  user: User,
};

const ROLE_COLORS = {
  owner: "text-yellow-500",
  admin: "text-violet-500",
  moderator: "text-blue-500",
  user: "text-muted-foreground",
};

function UserMenu() {
  const { user, metadata } = useCurrentUser();
  const { role, isMod } = useAdminAccess();
  const loginActions = useLoginActions();
  const navigate = useNavigate();
  const { otherUsers, setLogin, removeLogin } = useLoggedInAccounts();

  if (!user) return <LoginArea className="max-w-52" />;

  const displayName = metadata?.name ?? genUserName(user.pubkey);
  const avatar = metadata?.picture;
  const RoleIcon = ROLE_ICONS[role] ?? User;
  const roleColor = ROLE_COLORS[role] ?? "text-muted-foreground";

  const handleLogout = async () => {
    await loginActions.logout();
    navigate('/');
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors group">
          <div className="relative">
            <Avatar className="w-7 h-7">
              <AvatarImage src={avatar} alt={displayName} />
              <AvatarFallback className="text-xs font-bold">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            {isMod && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-background rounded-full flex items-center justify-center">
                <RoleIcon className={cn("w-2.5 h-2.5", roleColor)} />
              </div>
            )}
          </div>
          <span className="text-sm font-medium hidden sm:block max-w-[100px] truncate">{displayName}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60" sideOffset={8}>
        {/* Profile header */}
        <div className="px-3 py-3 border-b border-border/50">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={avatar} />
              <AvatarFallback className="font-bold">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground font-mono truncate">
                {user.pubkey.slice(0, 12)}…
              </p>
              {isMod && (
                <div className={cn("flex items-center gap-1 text-xs font-medium mt-0.5", roleColor)}>
                  <RoleIcon className="w-3 h-3" />
                  <span className="capitalize">{role}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation items */}
        {isMod && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground px-3 pt-2">Moderation</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link to="/dashboard" className="flex items-center gap-2 cursor-pointer">
                <LayoutDashboard className="w-4 h-4 text-primary" />
                <span>Dashboard</span>
                {role !== 'user' && (
                  <span className={cn("text-xs ml-auto font-medium capitalize", roleColor)}>{role}</span>
                )}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuLabel className="text-xs text-muted-foreground px-3 pt-2">Account</DropdownMenuLabel>

        <DropdownMenuItem asChild>
          <Link to="/submit" className="flex items-center gap-2 cursor-pointer">
            <Radio className="w-4 h-4" />
            <span>Submit a Relay</span>
          </Link>
        </DropdownMenuItem>

        {/* Other accounts */}
        {otherUsers.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground px-3">Switch Account</DropdownMenuLabel>
            {otherUsers.slice(0, 3).map((acct) => {
              const name = acct.metadata?.name ?? genUserName(acct.pubkey);
              return (
                <DropdownMenuItem
                  key={acct.id}
                  onClick={() => setLogin(acct.id)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={acct.metadata?.picture} />
                    <AvatarFallback className="text-xs">{name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm truncate flex-1">{name}</span>
                </DropdownMenuItem>
              );
            })}
          </>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleLogout}
          className="flex items-center gap-2 cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-500/10"
        >
          <LogOut className="w-4 h-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const [mobileSearch, setMobileSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { isMod } = useAdminAccess();
  const loginActions = useLoginActions();

  const handleDesktopSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { setSearchOpen(false); setSearchVal(""); }
    if (e.key === "Enter") {
      const q = searchVal.trim();
      if (q) navigate(`/relays?q=${encodeURIComponent(q)}`);
      else navigate("/relays");
      setSearchOpen(false);
      setSearchVal("");
    }
  };

  const handleMobileSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const q = mobileSearch.trim();
      setMenuOpen(false);
      setMobileSearch("");
      if (q) navigate(`/relays?q=${encodeURIComponent(q)}`);
      else navigate("/relays");
    }
  };

  const allNavLinks = [
    ...NAV_LINKS,
    ...(isMod ? [{ href: "/dashboard", label: "Dashboard" }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 w-full glass border-b border-border/50">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0 group">
            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                <Radio className="w-4 h-4 text-primary" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <span className="font-bold text-lg tracking-tight hidden sm:block">
              <span className="gradient-text">0x</span>
              <span className="text-foreground">NostrRelays</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  location.pathname === link.href
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                {link.label}
              </Link>
            ))}
            {/* Dashboard link for mods (desktop) */}
            {isMod && (
              <Link
                to="/dashboard"
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
                  location.pathname === "/dashboard"
                    ? "bg-primary/10 text-primary"
                    : "text-primary/70 hover:text-primary hover:bg-primary/5"
                )}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                Dashboard
              </Link>
            )}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Search */}
            {searchOpen ? (
              <div className="hidden md:flex items-center gap-2 animate-in slide-in-from-right-4 duration-200">
                <Input
                  ref={searchRef}
                  autoFocus
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  placeholder="Search relays…"
                  className="w-48 h-8 text-sm"
                  onKeyDown={handleDesktopSearch}
                />
                <Button variant="ghost" size="icon" className="h-8 w-8"
                  onClick={() => { setSearchOpen(false); setSearchVal(""); }}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost" size="icon"
                className="hidden md:flex h-8 w-8"
                onClick={() => setSearchOpen(true)}
                title="Search relays"
              >
                <Search className="w-4 h-4" />
              </Button>
            )}

            {/* Theme toggle */}
            <Button
              variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            {/* User menu or Find Relays CTA */}
            {user ? (
              <UserMenu />
            ) : (
              <>
                <Link to="/relays" className="hidden sm:block">
                  <Button size="sm" className="gap-1.5 text-xs font-semibold">
                    <Zap className="w-3.5 h-3.5" />
                    Find Relays
                  </Button>
                </Link>
                <div className="hidden sm:block">
                  <LoginArea />
                </div>
              </>
            )}

            {/* Mobile hamburger */}
            <Button
              variant="ghost" size="icon"
              className="md:hidden h-8 w-8"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl animate-in slide-in-from-top-2 duration-200">
          <div className="container mx-auto max-w-7xl px-4 py-3 flex flex-col gap-1">
            {/* Mobile search */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={mobileSearch}
                onChange={(e) => setMobileSearch(e.target.value)}
                placeholder="Search relays…"
                className="pl-9 h-9 text-sm"
                onKeyDown={handleMobileSearch}
              />
            </div>

            {allNavLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  location.pathname === link.href
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                {link.label}
              </Link>
            ))}

            {/* Mobile login/logout */}
            <div className="pt-2 mt-1 border-t border-border/40">
              {user ? (
                <div className="space-y-1">
                  <div className="px-3 py-1.5 text-xs text-muted-foreground font-mono truncate">
                    {user.pubkey.slice(0, 20)}…
                  </div>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors"
                    onClick={async () => {
                      setMenuOpen(false);
                      await loginActions.logout();
                      navigate('/');
                    }}
                  >
                    <LogOut className="w-4 h-4" /> Log out
                  </button>
                </div>
              ) : (
                <LoginArea className="w-full" />
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

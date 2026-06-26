/**
 * AddToRelayListButton — NIP-07 one-click "Add to my relay list"
 *
 * When clicked, updates the user's kind:10002 event to include this relay.
 * Shows current state (in list / not in list) and read/write configuration.
 */

import { useState } from 'react';
import {
  Plus, Check, Loader2, BookOpen, Send, ChevronDown,
  Trash2, LogIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useMyRelayList } from '@/hooks/useRelayListManager';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/utils';

interface AddToRelayListButtonProps {
  relayUrl: string;
  variant?: 'default' | 'compact' | 'inline';
  className?: string;
}

export function AddToRelayListButton({
  relayUrl,
  variant = 'default',
  className,
}: AddToRelayListButtonProps) {
  const { user } = useCurrentUser();
  const {
    hasRelay, getRelayConfig, addRelay, removeRelay,
    toggleRelayFlag, publishing,
  } = useMyRelayList();

  const [justAdded, setJustAdded] = useState(false);

  const inList = hasRelay(relayUrl);
  const config = getRelayConfig(relayUrl);

  if (!user) {
    if (variant === 'inline') return null;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled
              className={cn('gap-1.5 text-xs opacity-60', className)}
            >
              <LogIn className="w-3 h-3" />
              Add to Relays
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Log in with Nostr to manage your relay list</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const handleAdd = async (read: boolean, write: boolean) => {
    await addRelay(relayUrl, read, write);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2500);
  };

  const handleRemove = async () => {
    await removeRelay(relayUrl);
  };

  if (inList) {
    // Already in list — show config menu
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'gap-1.5 text-xs border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10',
              className,
            )}
            disabled={publishing}
          >
            {publishing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Check className="w-3 h-3" />
            )}
            In My Relays
            <ChevronDown className="w-3 h-3 ml-0.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Relay Configuration
          </DropdownMenuLabel>

          <DropdownMenuItem
            onClick={() => toggleRelayFlag(relayUrl, 'read')}
            className="flex items-center gap-2 text-xs cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="flex-1">Read</span>
            <span className={cn(
              'text-xs font-bold',
              config?.read ? 'text-emerald-500' : 'text-muted-foreground'
            )}>
              {config?.read ? 'ON' : 'OFF'}
            </span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => toggleRelayFlag(relayUrl, 'write')}
            className="flex items-center gap-2 text-xs cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="flex-1">Write</span>
            <span className={cn(
              'text-xs font-bold',
              config?.write ? 'text-emerald-500' : 'text-muted-foreground'
            )}>
              {config?.write ? 'ON' : 'OFF'}
            </span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={handleRemove}
            className="flex items-center gap-2 text-xs cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-500/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove from list
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Not in list — show add button with options
  if (variant === 'compact' || variant === 'inline') {
    return (
      <Button
        variant="outline"
        size="sm"
        className={cn(
          'gap-1.5 text-xs',
          justAdded && 'border-emerald-500/30 text-emerald-500',
          className,
        )}
        onClick={() => handleAdd(true, true)}
        disabled={publishing}
      >
        {publishing ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : justAdded ? (
          <Check className="w-3 h-3 text-emerald-500" />
        ) : (
          <Plus className="w-3 h-3" />
        )}
        {justAdded ? 'Added!' : 'Add to Relays'}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="default"
          size="sm"
          className={cn('gap-1.5 text-xs glow-primary-sm', className)}
          disabled={publishing}
        >
          {publishing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Plus className="w-3 h-3" />
          )}
          Add to My Relays
          <ChevronDown className="w-3 h-3 ml-0.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Add as…
        </DropdownMenuLabel>

        <DropdownMenuItem
          onClick={() => handleAdd(true, true)}
          className="flex items-center gap-2 text-xs cursor-pointer"
        >
          <div className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-blue-500" />
            <Send className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          Read + Write
          <span className="text-muted-foreground ml-auto">Most common</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleAdd(true, false)}
          className="flex items-center gap-2 text-xs cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-500" />
          Read only
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleAdd(false, true)}
          className="flex items-center gap-2 text-xs cursor-pointer"
        >
          <Send className="w-3.5 h-3.5 text-emerald-500" />
          Write only
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

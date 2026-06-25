/**
 * NIP Filter Presets — clickable filter chips with live relay counts.
 *
 * Shows "NIP-50 Search (34 online)" style chips that filter the relay list.
 */

import { Search, Zap, Lock, MessageCircle, Shield, Droplets, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LiveNetworkStats } from '@/hooks/useLiveRelayStore';

interface NIPPreset {
  nip?: number;
  label: string;
  icon: React.ElementType;
  color: string;
  activeColor: string;
  countKey?: keyof LiveNetworkStats;
  filterType: 'nip' | 'feature';
  featureKey?: string;
}

const PRESETS: NIPPreset[] = [
  {
    nip: 50, label: 'NIP-50 Search', icon: Search,
    color: 'border-blue-500/25 text-blue-500 bg-blue-500/5 hover:bg-blue-500/15',
    activeColor: 'bg-blue-500 text-white border-blue-500',
    countKey: 'nip50Search', filterType: 'nip',
  },
  {
    nip: 57, label: 'NIP-57 Zaps', icon: Zap,
    color: 'border-yellow-500/25 text-yellow-500 bg-yellow-500/5 hover:bg-yellow-500/15',
    activeColor: 'bg-yellow-500 text-white border-yellow-500',
    countKey: 'nip57Zaps', filterType: 'nip',
  },
  {
    nip: 17, label: 'NIP-17 DMs', icon: MessageCircle,
    color: 'border-cyan-500/25 text-cyan-500 bg-cyan-500/5 hover:bg-cyan-500/15',
    activeColor: 'bg-cyan-500 text-white border-cyan-500',
    countKey: 'nip17DMs', filterType: 'nip',
  },
  {
    nip: 42, label: 'NIP-42 Auth', icon: Lock,
    color: 'border-violet-500/25 text-violet-500 bg-violet-500/5 hover:bg-violet-500/15',
    activeColor: 'bg-violet-500 text-white border-violet-500',
    countKey: 'nip42Auth', filterType: 'nip',
  },
  {
    label: 'Blossom', icon: Droplets,
    color: 'border-sky-500/25 text-sky-500 bg-sky-500/5 hover:bg-sky-500/15',
    activeColor: 'bg-sky-500 text-white border-sky-500',
    countKey: 'blossomEnabled', filterType: 'feature', featureKey: 'blossom',
  },
  {
    label: 'Paid', icon: Coins,
    color: 'border-amber-500/25 text-amber-500 bg-amber-500/5 hover:bg-amber-500/15',
    activeColor: 'bg-amber-500 text-white border-amber-500',
    countKey: 'paidRelays', filterType: 'feature', featureKey: 'paid',
  },
];

interface NIPFilterPresetsProps {
  stats: LiveNetworkStats;
  activeNips: number[];
  activeFeatures: string[];
  onToggleNip: (nip: number) => void;
  onToggleFeature: (key: string) => void;
}

export function NIPFilterPresets({
  stats,
  activeNips,
  activeFeatures,
  onToggleNip,
  onToggleFeature,
}: NIPFilterPresetsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((preset) => {
        const Icon = preset.icon;
        const count = preset.countKey ? stats[preset.countKey] : 0;
        const isActive = preset.filterType === 'nip'
          ? preset.nip != null && activeNips.includes(preset.nip)
          : preset.featureKey != null && activeFeatures.includes(preset.featureKey);

        const handleClick = () => {
          if (preset.filterType === 'nip' && preset.nip != null) {
            onToggleNip(preset.nip);
          } else if (preset.featureKey) {
            onToggleFeature(preset.featureKey);
          }
        };

        return (
          <button
            key={preset.label}
            onClick={handleClick}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
              isActive ? preset.activeColor : preset.color,
            )}
          >
            <Icon className="w-3 h-3" />
            {preset.label}
            <span className={cn(
              'tabular-nums font-bold',
              isActive ? 'opacity-90' : 'opacity-70',
            )}>
              ({count})
            </span>
          </button>
        );
      })}
    </div>
  );
}

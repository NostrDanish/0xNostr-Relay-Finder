/**
 * ProtocolCoveragePage — Shows all NIPs supported by the app
 *
 * Displays a comprehensive grid of all Nostr Improvement Proposals
 * that this app can detect, verify, or interact with. Useful for
 * transparency and to demonstrate the app's capabilities.
 */

import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, XCircle, AlertCircle, ExternalLink, Code2,
  Shield, Zap, MessageSquare, Users, Globe2, Lock, FileText,
  Radio, Search, Database, RefreshCw, Settings, Tag,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TESTABLE_NIPS } from '@/hooks/useNIPVerifier';

// ─── NIP Database ─────────────────────────────────────────────────────────────

interface NIPInfo {
  number: number;
  name: string;
  description: string;
  category: 'core' | 'relay' | 'client' | 'social' | 'monetization' | 'privacy' | 'moderation' | 'data';
  implemented: boolean;
  verified: boolean;
  icon: React.ReactNode;
}

const NIP_DATABASE: NIPInfo[] = [
  { number: 1, name: 'Basic Protocol', description: 'Core event flow: REQ, EVENT, EOSE, CLOSE, NOTICE, OK', category: 'core', implemented: true, verified: true, icon: <Radio className="w-4 h-4" /> },
  { number: 2, name: 'Follow List', description: 'Contact list for social graph (kind:3)', category: 'social', implemented: true, verified: false, icon: <Users className="w-4 h-4" /> },
  { number: 5, name: 'NIP-05 Identifiers', description: 'DNS-based identity mapping (user@domain.com)', category: 'core', implemented: true, verified: false, icon: <Globe2 className="w-4 h-4" /> },
  { number: 7, name: 'window.nostr', description: 'Browser extension signer capability', category: 'client', implemented: true, verified: false, icon: <Zap className="w-4 h-4" /> },
  { number: 9, name: 'Event Deletion', description: 'Request deletion of events (kind:5)', category: 'core', implemented: true, verified: false, icon: <XCircle className="w-4 h-4" /> },
  { number: 11, name: 'Relay Information', description: 'HTTP document describing relay capabilities and limitations', category: 'relay', implemented: true, verified: true, icon: <FileText className="w-4 h-4" /> },
  { number: 13, name: 'Proof of Work', description: 'Spam prevention via computational work', category: 'relay', implemented: true, verified: true, icon: <Shield className="w-4 h-4" /> },
  { number: 15, name: 'EOSE Marker', description: 'End of stored events notification', category: 'relay', implemented: true, verified: true, icon: <CheckCircle2 className="w-4 h-4" /> },
  { number: 17, name: 'Private DMs', description: 'NIP-17 encrypted direct messages', category: 'privacy', implemented: true, verified: false, icon: <Lock className="w-4 h-4" /> },
  { number: 20, name: 'Command Results', description: 'OK responses to EVENT commands', category: 'relay', implemented: true, verified: true, icon: <CheckCircle2 className="w-4 h-4" /> },
  { number: 22, name: 'Comments', description: 'Threaded comments scoped to external IDs (kind:1111)', category: 'social', implemented: true, verified: false, icon: <MessageSquare className="w-4 h-4" /> },
  { number: 23, name: 'Long-form Content', description: 'Articles and blogs (kind:30023)', category: 'data', implemented: true, verified: false, icon: <FileText className="w-4 h-4" /> },
  { number: 25, name: 'Reactions', description: 'Upvotes and reactions (kind:7)', category: 'social', implemented: true, verified: false, icon: <CheckCircle2 className="w-4 h-4" /> },
  { number: 32, name: 'Labeling', description: 'Categorization and moderation labels (kind:1985)', category: 'moderation', implemented: true, verified: false, icon: <Tag className="w-4 h-4" /> },
  { number: 42, name: 'Authentication', description: 'Client auth to relays via signed events (kind:22242)', category: 'relay', implemented: true, verified: true, icon: <Lock className="w-4 h-4" /> },
  { number: 43, name: 'Membership & Access', description: 'Invite-only relays, roles, join/leave requests', category: 'relay', implemented: true, verified: true, icon: <Users className="w-4 h-4" /> },
  { number: 45, name: 'Event Counting', description: 'COUNT requests for event statistics', category: 'relay', implemented: true, verified: true, icon: <Database className="w-4 h-4" /> },
  { number: 50, name: 'Full-Text Search', description: 'Search filter for content queries', category: 'relay', implemented: true, verified: true, icon: <Search className="w-4 h-4" /> },
  { number: 51, name: 'Lists', description: 'Relay sets, favorites, mute lists (kind:30002, 10012)', category: 'data', implemented: true, verified: false, icon: <FileText className="w-4 h-4" /> },
  { number: 56, name: 'Reporting', description: 'Content reporting and moderation flags (kind:1984)', category: 'moderation', implemented: true, verified: false, icon: <AlertCircle className="w-4 h-4" /> },
  { number: 57, name: 'Zaps', description: 'Lightning payments to notes (kind:9734/9735)', category: 'monetization', implemented: true, verified: false, icon: <Zap className="w-4 h-4" /> },
  { number: 65, name: 'Relay List Metadata', description: 'User relay preferences (kind:10002)', category: 'data', implemented: true, verified: false, icon: <Radio className="w-4 h-4" /> },
  { number: 66, name: 'Relay Discovery', description: 'Liveness monitoring and relay metadata (kind:30166/10166)', category: 'relay', implemented: true, verified: true, icon: <Radio className="w-4 h-4" /> },
  { number: 67, name: 'EOSE Completeness', description: 'Hints for complete vs. partial result sets', category: 'relay', implemented: true, verified: true, icon: <CheckCircle2 className="w-4 h-4" /> },
  { number: 70, name: 'Protected Events', description: 'Ephemeral events with `-` tag protection', category: 'relay', implemented: false, verified: false, icon: <Lock className="w-4 h-4" /> },
  { number: 71, name: 'Video Events', description: 'Video content and streaming (kind:21/22)', category: 'data', implemented: true, verified: false, icon: <FileText className="w-4 h-4" /> },
  { number: 77, name: 'Negentropy Sync', description: 'Efficient set reconciliation for event syncing', category: 'relay', implemented: true, verified: true, icon: <RefreshCw className="w-4 h-4" /> },
  { number: 78, name: 'App-specific Data', description: 'Arbitrary app data storage (kind:30078)', category: 'data', implemented: true, verified: false, icon: <Database className="w-4 h-4" /> },
  { number: 85, name: 'Trusted Assertions', description: 'WoT-based reputation scores from providers (kind:30382/30384/30385)', category: 'social', implemented: true, verified: false, icon: <Shield className="w-4 h-4" /> },
  { number: 86, name: 'Relay Management', description: 'HTTP API for relay administration', category: 'relay', implemented: true, verified: true, icon: <Settings className="w-4 h-4" /> },
  { number: 89, name: 'App Handlers', description: 'Discover apps that handle unknown event kinds (kind:31989/31990)', category: 'client', implemented: true, verified: false, icon: <Code2 className="w-4 h-4" /> },
  { number: 94, name: 'File Metadata', description: 'File attachment metadata (kind:1063)', category: 'data', implemented: true, verified: false, icon: <FileText className="w-4 h-4" /> },
  { number: 96, name: 'HTTP File Storage', description: 'File upload and storage integration', category: 'data', implemented: true, verified: false, icon: <Database className="w-4 h-4" /> },
  { number: 98, name: 'HTTP Auth', description: 'NIP-98 authentication for HTTP APIs (kind:27235)', category: 'client', implemented: true, verified: false, icon: <Lock className="w-4 h-4" /> },
  { number: 99, name: 'Classified Listings', description: 'Marketplace and commerce (kind:30402)', category: 'monetization', implemented: true, verified: false, icon: <FileText className="w-4 h-4" /> },
];

const CATEGORY_COLORS: Record<string, string> = {
  core: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  relay: 'bg-violet-500/10 text-violet-500 border-violet-500/30',
  client: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30',
  social: 'bg-pink-500/10 text-pink-500 border-pink-500/30',
  monetization: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  privacy: 'bg-rose-500/10 text-rose-500 border-rose-500/30',
  moderation: 'bg-red-500/10 text-red-500 border-red-500/30',
  data: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ProtocolCoveragePage() {
  useSeoMeta({
    title: 'Protocol Coverage — 0xRelay-Finder',
    description: 'Complete list of NIPs supported by 0xRelay-Finder. We detect, verify, and interact with 30+ Nostr Improvement Proposals.',
  });

  const implemented = NIP_DATABASE.filter((n) => n.implemented);
  const verified = NIP_DATABASE.filter((n) => n.verified);
  const testable = NIP_DATABASE.filter((n) => TESTABLE_NIPS.includes(n.number));

  const categories = [...new Set(NIP_DATABASE.map((n) => n.category))];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary font-medium mb-3">
          <Code2 className="w-3.5 h-3.5" />
          Protocol Coverage
        </div>
        <h1 className="text-3xl font-black mb-2">Supported NIPs</h1>
        <p className="text-muted-foreground text-sm max-w-xl mx-auto">
          0xRelay-Finder supports {implemented.length} Nostr Improvement Proposals,
          with {verified.length} verifiable via live WebSocket testing.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Total NIPs', value: NIP_DATABASE.length, icon: <Code2 className="w-4 h-4 text-primary" /> },
          { label: 'Implemented', value: implemented.length, icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" /> },
          { label: 'Verifiable', value: verified.length, icon: <Shield className="w-4 h-4 text-blue-500" /> },
          { label: 'Auto-Testable', value: testable.length, icon: <Zap className="w-4 h-4 text-yellow-500" /> },
        ].map((s) => (
          <Card key={s.label} className="border-border/60 text-center">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-center gap-2 mb-1">{s.icon}</div>
              <div className="text-2xl font-black">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* NIP Grid by Category */}
      {categories.map((category) => {
        const nips = NIP_DATABASE.filter((n) => n.category === category);
        if (nips.length === 0) return null;

        return (
          <div key={category} className="mb-8">
            <h2 className="text-lg font-bold mb-3 capitalize flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${CATEGORY_COLORS[category].split(' ')[0]}`} />
              {category.replace('-', ' ')} ({nips.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {nips.map((nip) => (
                <Card
                  key={nip.number}
                  className={`border-border/60 hover:border-primary/30 transition-all ${
                    !nip.implemented ? 'opacity-50' : ''
                  }`}
                >
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">
                          NIP-{String(nip.number).padStart(2, '0')}
                        </span>
                        {nip.implemented ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        {nip.verified && (
                          <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-500 px-1 py-0">
                            Verifiable
                          </Badge>
                        )}
                      </div>
                      <a
                        href={`https://github.com/nostr-protocol/nips/blob/master/${String(nip.number).padStart(2, '0')}.md`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <div className="font-semibold text-sm mb-1 flex items-center gap-2">
                      {nip.icon}
                      {nip.name}
                    </div>
                    <p className="text-xs text-muted-foreground">{nip.description}</p>
                    <div className="mt-2">
                      <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[nip.category]}`}>
                        {nip.category}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

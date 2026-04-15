import { useState, useCallback } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  APP_RELAY_URL,
  APP_PUBKEY_HEX,
  KIND_RELAY_SUBMISSION,
  RELAY_SUBMISSION_D_PREFIX,
} from '@/lib/constants';
import type { RelayRecord, UseCaseTag } from '@/types/relay';

export type SubmitStatus =
  | 'idle'
  | 'encrypting'
  | 'publishing'
  | 'success'
  | 'error';

export interface SubmitResult {
  status: SubmitStatus;
  eventId?: string;
  nevent?: string;
  error?: string;
  /** The WSS URL of the relay that was submitted */
  relayUrl?: string;
}

/**
 * Submission payload — the full public data stored on-chain (kind:30078).
 * Sensitive operator notes are NIP-44 encrypted to the app pubkey.
 */
export interface RelaySubmissionPayload {
  url: string;
  name: string;
  description: string;
  nip11: RelayRecord['nip11'];
  useCases: UseCaseTag[];
  isFree: boolean;
  paidPriceUsd?: number;
  submitterNotes?: string; // will be encrypted
  submittedAt: number;
  submitterPubkey?: string;
  version: '1.0';
}

/**
 * Hook for submitting a new relay to the 0xNostrRelayFinder directory.
 *
 * Publishing strategy:
 * 1. Build a kind:30078 addressable event with d-tag = "0xrelay:<url>"
 * 2. Public JSON content: relay name, description, NIP-11 snapshot, use-cases, pricing
 * 3. If user provided private notes: NIP-44 encrypt them to the app pubkey and store
 *    as an additional tag ["encrypted_notes", <ciphertext>]
 * 4. Publish to wss://0xPrivacy.nostr1.com (our app relay) + 2-3 seed relays
 * 5. Return the event ID so user can reference it
 *
 * Event structure:
 * {
 *   kind: 30078,
 *   content: JSON.stringify(publicPayload),
 *   tags: [
 *     ["d", "0xrelay:wss%3A%2F%2Frelay.example.com"],
 *     ["r", "wss://relay.example.com"],
 *     ["t", "relay-submission"],
 *     ["t", "General"],           // one per use case
 *     ["status", "pending"],
 *     ["alt", "Nostr relay directory submission for wss://relay.example.com"],
 *     ["encrypted_notes", "<nip44_ciphertext>"],  // optional, encrypted to app pubkey
 *   ]
 * }
 */
export function useRelaySubmit() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const [result, setResult] = useState<SubmitResult>({ status: 'idle' });

  const submit = useCallback(
    async (payload: RelaySubmissionPayload) => {
      if (!user) {
        setResult({ status: 'error', error: 'You must be logged in with Nostr to submit a relay.' });
        return;
      }

      try {
        // ── Step 1: Build the public JSON content ────────────────────────────
        const publicPayload = {
          url: payload.url,
          name: payload.name,
          description: payload.description,
          nip11: payload.nip11,
          useCases: payload.useCases,
          isFree: payload.isFree,
          paidPriceUsd: payload.paidPriceUsd,
          submittedAt: payload.submittedAt,
          submitterPubkey: payload.submitterPubkey,
          version: payload.version,
        };

        // ── Step 2: Encrypt private notes with NIP-44 ───────────────────────
        let encryptedNotes: string | undefined;

        if (payload.submitterNotes?.trim() && user.signer.nip44) {
          try {
            setResult({ status: 'encrypting' });
            // Encrypt to the app's pubkey so only the app operator can read it
            encryptedNotes = await user.signer.nip44.encrypt(
              APP_PUBKEY_HEX,
              payload.submitterNotes.trim()
            );
          } catch (encErr) {
            console.warn('[SubmitRelay] NIP-44 encryption failed, submitting without encrypted notes:', encErr);
            // Non-fatal: continue without encrypted notes
          }
        }

        // ── Step 3: Build event tags ─────────────────────────────────────────
        const dTag = `${RELAY_SUBMISSION_D_PREFIX}${encodeURIComponent(payload.url)}`;

        const tags: string[][] = [
          ['d', dTag],
          ['r', payload.url],
          ['t', 'relay-submission'],
          ['t', '0xnostrrelays'],
          ['status', 'pending'],
          ['alt', `Nostr relay directory submission for ${payload.url}`],
        ];

        // Add one tag per use case for relay-level filtering
        for (const uc of payload.useCases) {
          tags.push(['t', uc.toLowerCase().replace(/\s+/g, '-')]);
        }

        // Add pricing tag
        tags.push(['pricing', payload.isFree ? 'free' : 'paid']);

        // Encrypted notes (optional)
        if (encryptedNotes) {
          tags.push(['encrypted_notes', encryptedNotes]);
          // Also tag recipient pubkey so it's clear who can decrypt
          tags.push(['p', APP_PUBKEY_HEX]);
        }

        // ── Step 4: Publish via our app relay ─────────────────────────────
        setResult({ status: 'publishing' });

        // Use the app relay specifically
        const appRelay = nostr.relay(APP_RELAY_URL);

        const event = await user.signer.signEvent({
          kind: KIND_RELAY_SUBMISSION,
          content: JSON.stringify(publicPayload),
          tags,
          created_at: Math.floor(Date.now() / 1000),
        });

        await appRelay.event(event);

        // Also publish to the default pool for discoverability
        try {
          await nostr.event(event);
        } catch {
          // Non-fatal if broader publish fails; we got the app relay
        }

        setResult({
          status: 'success',
          eventId: event.id,
          relayUrl: payload.url,
        });

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[useRelaySubmit] Error:', err);
        setResult({
          status: 'error',
          error: `Submission failed: ${msg}. Please check your connection and try again.`,
        });
      }
    },
    [nostr, user]
  );

  const reset = useCallback(() => {
    setResult({ status: 'idle' });
  }, []);

  return { result, submit, reset };
}

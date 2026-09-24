import { supabase } from './supabase';

export type BroadcastTargetType = 'ALL' | 'ORG' | 'ROLE' | 'USER';

export interface SendBroadcastInput {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  targetType: BroadcastTargetType;
  targetValue?: string;
}

export interface BroadcastResult {
  success: boolean;
  message?: string;
  broadcastId?: string;
  recipientCount?: number;
  deliveredCount?: number;
  failedCount?: number;
  staleCleaned?: number;
}

export interface BroadcastHistoryRow {
  id: string;
  sent_by: string | null;
  sent_by_name: string | null;
  title: string;
  body: string;
  url: string | null;
  target_type: BroadcastTargetType;
  target_value: string | null;
  recipient_count: number;
  delivered_count: number;
  failed_count: number;
  stale_cleaned: number;
  created: string;
}

async function invokeAdminSendPush(_payload: Record<string, unknown>): Promise<BroadcastResult> {
  // Push notifications require VAPID configuration and edge functions.
  // Return graceful error so the UI can show a proper message.
  return { success: false, message: 'Push notifications require additional server configuration.' };
}

export const pushBroadcastService = {
  async previewRecipientCount(
    targetType: BroadcastTargetType,
    targetValue?: string,
  ): Promise<number> {
    const result = await invokeAdminSendPush({
      targetType,
      targetValue,
      previewOnly: true,
    });
    return result.recipientCount ?? 0;
  },

  async sendBroadcast(input: SendBroadcastInput): Promise<BroadcastResult> {
    return invokeAdminSendPush({
      title: input.title,
      body: input.body,
      url: input.url,
      icon: input.icon,
      targetType: input.targetType,
      targetValue: input.targetValue,
      previewOnly: false,
    });
  },

  async listBroadcasts(limit = 50): Promise<BroadcastHistoryRow[]> {
    const { data, error } = await supabase
      .from('broadcasts')
      .select('*')
      .order('created', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('[pushBroadcastService] listBroadcasts error:', error.message);
      return [];
    }
    return (data ?? []) as BroadcastHistoryRow[];
  },
};

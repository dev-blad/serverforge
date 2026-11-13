import type { EmbedPayload } from '../../services/builder/gateway.js';
import { box, discordTime, padNumber } from '../common.js';

export interface ApplicationAnswer {
  question: string;
  answer: string;
}

export interface ApplicationData {
  answers: ApplicationAnswer[];
  reviewMessageId: string | null;
  reviewedBy: string | null;
  reason: string | null;
}

export type ApplicationStatus = 'pending' | 'accepted' | 'denied';

const STATUS: Record<ApplicationStatus, { emoji: string; label: string; color: number }> = {
  pending: { emoji: '🕒', label: 'Pending review', color: 0x5865f2 },
  accepted: { emoji: '✅', label: 'Accepted', color: 0x57f287 },
  denied: { emoji: '❌', label: 'Denied', color: 0xed4245 },
};

export function applicationReviewEmbed(options: {
  number: number;
  applicantId: string;
  applicantName: string;
  data: ApplicationData;
  status: ApplicationStatus;
  createdAt: Date;
}): EmbedPayload {
  const s = STATUS[options.status];
  return {
    author: options.applicantName,
    title: `${s.emoji} Application ${padNumber(options.number)}`,
    color: s.color,
    description: [
      box('Applicant', `<@${options.applicantId}>`),
      box('Submitted', discordTime(options.createdAt)),
      box('Status', `${s.emoji} **${s.label}**`),
      ...(options.data.reviewedBy ? [box('Reviewed by', `<@${options.data.reviewedBy}>`)] : []),
    ].join('\n'),
    fields: options.data.answers.map((a) => ({
      name: a.question,
      value: (a.answer.trim() || '—').slice(0, 1024),
    })),
  };
}

export function applicantResultMessage(status: 'accepted' | 'denied', serverName: string): string {
  return status === 'accepted'
    ? `🎉 Good news — your application to **${serverName}** has been **accepted**! A member of the team will be in touch.`
    : `Thanks for applying to **${serverName}**. Unfortunately your application wasn’t successful this time.`;
}

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

export interface NotificationPayload {
  level: NotificationLevel;
  title: string;
  message: string;
  source?: string;
  projectId?: string;
  projectName?: string;
  stepId?: string;
  stepName?: string;
}

export const publishNotification = (payload: NotificationPayload) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('pwc:notification', { detail: payload }));
};

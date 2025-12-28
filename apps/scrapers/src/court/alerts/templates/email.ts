/**
 * Email Templates for Court Alerts
 * HTML and text templates for alert emails
 */

import type { CourtAlert, AlertTemplateVars, CourtAlertType } from '../types';
import { getAlertTypeDisplayName } from '../types';
import { groupAlertsByCase, sortAlerts, generateDigestSummary } from '../batching';

/**
 * Generate subject line for an alert
 */
export function generateSubject(alert: CourtAlert): string {
  const prefix = alert.priority === 'critical' ? '[URGENT] ' : '';
  return `${prefix}${alert.caseNumber}: ${alert.title}`;
}

/**
 * Generate subject line for a digest email
 */
export function generateDigestSubject(alerts: CourtAlert[]): string {
  const hasCritical = alerts.some(a => a.priority === 'critical');
  const prefix = hasCritical ? '[URGENT] ' : '';
  const caseCount = new Set(alerts.map(a => a.caseNumber)).size;

  if (caseCount === 1) {
    return `${prefix}${alerts.length} updates for case ${alerts[0].caseNumber}`;
  }

  return `${prefix}${alerts.length} court updates across ${caseCount} cases`;
}

/**
 * Generate HTML email for a single alert
 */
export function generateAlertEmailHtml(vars: AlertTemplateVars): string {
  const priorityColor = getPriorityColor(vars.alertType);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${vars.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: ${priorityColor}; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">
                ${getAlertTypeDisplayName(vars.alertType)}
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; color: #666666; font-size: 14px;">
                Hello ${vars.userName},
              </p>

              <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <h2 style="margin: 0 0 8px; color: #1a1a1a; font-size: 18px; font-weight: 600;">
                  ${vars.title}
                </h2>
                <p style="margin: 0 0 16px; color: #374151; font-size: 14px; line-height: 1.6;">
                  ${vars.message}
                </p>

                <table cellpadding="0" cellspacing="0" style="width: 100%;">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 12px;">Case Number</span><br>
                      <span style="color: #1a1a1a; font-size: 14px; font-weight: 500;">${vars.caseNumber}</span>
                    </td>
                  </tr>
                  ${vars.caseName ? `
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                      <span style="color: #6b7280; font-size: 12px;">Case Name</span><br>
                      <span style="color: #1a1a1a; font-size: 14px; font-weight: 500;">${vars.caseName}</span>
                    </td>
                  </tr>
                  ` : ''}
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #6b7280; font-size: 12px;">Court</span><br>
                      <span style="color: #1a1a1a; font-size: 14px; font-weight: 500;">${vars.courtName}</span>
                    </td>
                  </tr>
                </table>
              </div>

              ${vars.changeDetails ? `
              <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px; color: #374151; font-size: 14px; font-weight: 600;">
                  Change Details
                </h3>
                <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">
                  ${vars.changeDetails}
                </p>
              </div>
              ` : ''}

              ${vars.actionUrl ? `
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${vars.actionUrl}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 500;">
                  View Case Details
                </a>
              </div>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px;">
                You're receiving this because you're tracking this case.
              </p>
              ${vars.unsubscribeUrl ? `
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                <a href="${vars.unsubscribeUrl}" style="color: #3b82f6; text-decoration: none;">Manage alert preferences</a>
              </p>
              ` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * Generate plain text email for a single alert
 */
export function generateAlertEmailText(vars: AlertTemplateVars): string {
  let text = `${getAlertTypeDisplayName(vars.alertType)}\n`;
  text += `${'='.repeat(40)}\n\n`;

  text += `Hello ${vars.userName},\n\n`;
  text += `${vars.title}\n\n`;
  text += `${vars.message}\n\n`;

  text += `Case Details:\n`;
  text += `- Case Number: ${vars.caseNumber}\n`;
  if (vars.caseName) {
    text += `- Case Name: ${vars.caseName}\n`;
  }
  text += `- Court: ${vars.courtName}\n\n`;

  if (vars.changeDetails) {
    text += `Change Details:\n${vars.changeDetails}\n\n`;
  }

  if (vars.actionUrl) {
    text += `View case details: ${vars.actionUrl}\n\n`;
  }

  text += `---\n`;
  text += `You're receiving this because you're tracking this case.\n`;
  if (vars.unsubscribeUrl) {
    text += `Manage preferences: ${vars.unsubscribeUrl}\n`;
  }

  return text;
}

/**
 * Generate HTML digest email for multiple alerts
 */
export function generateDigestEmailHtml(
  alerts: CourtAlert[],
  userName: string,
  actionBaseUrl: string,
  unsubscribeUrl?: string
): string {
  const sortedAlerts = sortAlerts(alerts);
  const byCase = groupAlertsByCase(sortedAlerts);
  const summary = generateDigestSummary(alerts);

  let caseSections = '';
  for (const [caseNumber, caseAlerts] of byCase) {
    caseSections += generateCaseSection(caseNumber, caseAlerts, actionBaseUrl);
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Court Updates Digest</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #1e40af; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">
                Court Updates Digest
              </h1>
            </td>
          </tr>

          <!-- Summary -->
          <tr>
            <td style="padding: 24px; background-color: #eff6ff; border-bottom: 1px solid #dbeafe;">
              <p style="margin: 0; color: #1e40af; font-size: 14px; font-weight: 500;">
                ${summary}
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 24px; color: #666666; font-size: 14px;">
                Hello ${userName}, here's a summary of recent updates to your tracked cases:
              </p>

              ${caseSections}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px;">
                This is a digest of updates to your tracked cases.
              </p>
              ${unsubscribeUrl ? `
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                <a href="${unsubscribeUrl}" style="color: #3b82f6; text-decoration: none;">Manage alert preferences</a>
              </p>
              ` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * Generate a case section for the digest
 */
function generateCaseSection(
  caseNumber: string,
  alerts: CourtAlert[],
  actionBaseUrl: string
): string {
  const alertItems = alerts.map(alert => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #f3f4f6;">
        <div style="display: flex; align-items: flex-start;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${getPriorityColor(alert.alertType)}; margin-right: 12px; margin-top: 6px;"></span>
          <div>
            <p style="margin: 0 0 4px; color: #1a1a1a; font-size: 14px; font-weight: 500;">
              ${alert.title}
            </p>
            <p style="margin: 0; color: #6b7280; font-size: 13px;">
              ${alert.message}
            </p>
          </div>
        </div>
      </td>
    </tr>
  `).join('');

  return `
    <div style="margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #f8fafc; padding: 16px; border-bottom: 1px solid #e5e7eb;">
        <h3 style="margin: 0; color: #1a1a1a; font-size: 16px; font-weight: 600;">
          Case ${caseNumber}
        </h3>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${alertItems}
      </table>
      <div style="padding: 12px; text-align: center;">
        <a href="${actionBaseUrl}/cases/${caseNumber}" style="color: #3b82f6; font-size: 13px; text-decoration: none;">
          View case details →
        </a>
      </div>
    </div>
  `;
}

/**
 * Get color for alert type
 */
function getPriorityColor(alertType: CourtAlertType): string {
  const colors: Partial<Record<CourtAlertType, string>> = {
    new_ruling: '#dc2626',
    case_disposed: '#dc2626',
    hearing_cancelled: '#f97316',
    hearing_scheduled: '#3b82f6',
    hearing_rescheduled: '#f97316',
    status_change: '#8b5cf6',
    new_filing: '#10b981',
    judge_changed: '#6366f1',
    party_added: '#14b8a6',
    party_removed: '#f43f5e',
  };

  return colors[alertType] || '#6b7280';
}

/**
 * Export template functions
 */
export const emailTemplates = {
  generateSubject,
  generateDigestSubject,
  generateAlertEmailHtml,
  generateAlertEmailText,
  generateDigestEmailHtml,
};

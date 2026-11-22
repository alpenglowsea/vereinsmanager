import { MeetingTemplateSettings } from '../types';

export const DEFAULT_MEETING_TEMPLATE: MeetingTemplateSettings = {
  id: 'main_meeting_template',
  templateName: 'Offizielles Vereinsprotokoll (BGB-konform)',
  customBlankoDataUrl: '',
  customBlankoFileName: '',
  customBlankoUploadedAt: '',
  marginTop: 38,
  marginBottom: 25,
  marginLeft: 20,
  marginRight: 20,
  showClubHeader: true,
  showClubLogo: true,
  showSignaturesBlock: true,
  showRegisterExtractNotice: true,
  accentColor: '#4f46e5'
};
